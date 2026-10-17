-- FlatFair schema. Paste into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once. NOTE: it drops the old "expenses" table from the
-- first version of the app, so any test expenses saved before are deleted.

drop table if exists public.expenses cascade;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'My flat' check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Each user belongs to exactly one household (unique user_id).
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies don't recurse)
-- ---------------------------------------------------------------------------

create or replace function public.my_household_id()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

create or replace function public.my_household_member_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), '{}') from public.household_members
  where household_id = public.my_household_id();
$$;

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null default public.my_household_id() references public.households (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description   text not null check (char_length(description) between 1 and 200),
  amount        numeric(10, 2) not null default 0 check (amount >= 0),
  paid_by       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  split_between uuid[] not null default public.my_household_member_ids() check (cardinality(split_between) >= 1),
  created_at    timestamptz not null default now()
);

-- Gives a logged-in user a household if they don't have one yet (no onboarding needed).
create or replace function public.ensure_household()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  new_hid uuid;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;

  select household_id into hid from public.household_members where user_id = auth.uid();
  if hid is not null then return hid; end if;

  insert into public.households (created_by) values (auth.uid()) returning id into new_hid;
  insert into public.household_members (household_id, user_id, display_name)
  values (new_hid, auth.uid(), left(coalesce(nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''), 'Me'), 40))
  on conflict (user_id) do nothing;

  select household_id into hid from public.household_members where user_id = auth.uid();
  if hid <> new_hid then delete from public.households where id = new_hid; end if;
  return hid;
end;
$$;

-- Moves the logged-in user into the household with this invite code.
create or replace function public.join_household(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_hid uuid;
  old_hid uuid;
  old_name text;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;

  select id into new_hid from public.households where invite_code = upper(trim(code));
  if new_hid is null then raise exception 'No household found with that invite code'; end if;

  select household_id, display_name into old_hid, old_name
  from public.household_members where user_id = auth.uid();
  if old_hid = new_hid then return new_hid; end if;

  delete from public.household_members where user_id = auth.uid();
  insert into public.household_members (household_id, user_id, display_name)
  values (new_hid, auth.uid(), coalesce(old_name, left(coalesce(nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''), 'Me'), 40)));

  -- Remove the old household if nobody is left in it.
  if old_hid is not null and not exists (select 1 from public.household_members where household_id = old_hid) then
    delete from public.households where id = old_hid;
  end if;

  return new_hid;
end;
$$;

revoke all on function public.my_household_id() from public, anon;
revoke all on function public.my_household_member_ids() from public, anon;
revoke all on function public.ensure_household() from public, anon;
revoke all on function public.join_household(text) from public, anon;
grant execute on function public.my_household_id() to authenticated;
grant execute on function public.my_household_member_ids() to authenticated;
grant execute on function public.ensure_household() to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: only logged-in members of the same household see data
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Members can read their household" on public.households;
create policy "Members can read their household"
  on public.households for select to authenticated
  using (auth.uid() is not null and id = public.my_household_id());

drop policy if exists "Members can rename their household" on public.households;
create policy "Members can rename their household"
  on public.households for update to authenticated
  using (auth.uid() is not null and id = public.my_household_id())
  with check (id = public.my_household_id());

drop policy if exists "Members can see their flatmates" on public.household_members;
create policy "Members can see their flatmates"
  on public.household_members for select to authenticated
  using (auth.uid() is not null and household_id = public.my_household_id());

drop policy if exists "Users can change their own display name" on public.household_members;
create policy "Users can change their own display name"
  on public.household_members for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and household_id = public.my_household_id());

drop policy if exists "Members can read household expenses" on public.expenses;
create policy "Members can read household expenses"
  on public.expenses for select to authenticated
  using (auth.uid() is not null and household_id = public.my_household_id());

drop policy if exists "Members can add household expenses" on public.expenses;
create policy "Members can add household expenses"
  on public.expenses for insert to authenticated
  with check (
    auth.uid() = user_id
    and household_id = public.my_household_id()
    and paid_by = any (public.my_household_member_ids())
    and split_between <@ public.my_household_member_ids()
  );

drop policy if exists "Users can delete their own expenses" on public.expenses;
create policy "Users can delete their own expenses"
  on public.expenses for delete to authenticated
  using (auth.uid() = user_id and household_id = public.my_household_id());

-- Only the needed privileges; logged-out (anon) visitors get nothing.
revoke all on public.households, public.household_members, public.expenses from anon;
grant select on public.households, public.household_members, public.expenses to authenticated;
grant update (name) on public.households to authenticated;
grant update (display_name) on public.household_members to authenticated;
grant insert, delete on public.expenses to authenticated;
