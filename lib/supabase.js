import { createClient } from "@supabase/supabase-js";

// Only the public URL and the publishable (anon) key are used in the browser.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
