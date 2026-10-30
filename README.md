# tic•tac•together

Real-time two-player Tic-Tac-Toe built with React, Vite, and Supabase Realtime.

## Deploy

1. Create a Supabase project, open SQL Editor, and run `supabase/schema.sql`.
2. In **Database → Replication**, ensure `games` is included in the `supabase_realtime` publication (the SQL attempts this automatically). Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
3. `npm install && npm run dev`
4. Push to GitHub and import the repository in Vercel. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Project Settings → Environment Variables, then deploy.

Create a room, press **Share invite**, and open the link in a second browser/device. The second player enters a name and joins as O.

## Two-device acceptance check

Open a created invite in an incognito window or a second device, join as O, and play alternate moves. Each square and score should update instantly in both windows. Close one window: the other will show the disconnect note; reopening the same invite restores that player's presence.
