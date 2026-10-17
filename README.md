# FlatFair

FlatFair helps university students living with roommates track shared expenses so they know who owes whom.

## Run locally

1. Install Node.js 20 or newer (https://nodejs.org).
2. Make sure `.env.local` contains:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```
3. Run the SQL in `supabase/schema.sql` in Supabase > SQL Editor, and turn off "Confirm email" (Authentication > Sign In / Providers > Email).
4. `npm install`
5. `npm run dev`, then open http://localhost:3000

## Deploy

Import the GitHub repo in Vercel and add the same two environment variables in Project Settings > Environment Variables.
