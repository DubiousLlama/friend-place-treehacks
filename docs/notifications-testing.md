# Testing the notification system

## How it deploys

- **Vercel** (via merge to `main`): deploys the **Next.js app** only. It does **not** send notification emails.
- **Supabase Edge Functions** (`notify-game-event`, `notify-stale-check`) run on **Supabase’s servers**. They are the only thing that call Resend. So:
  - No record in Resend usually means the Edge Function either wasn’t invoked or didn’t reach the Resend call (see Troubleshooting below).
  - Secrets for Resend must be set in **Supabase** (Project Settings → Edge Functions → Secrets), not only in `.env.local`. `.env.local` is for the Next.js app; Edge Functions don’t see it.

## Test Resend locally (no Vercel, no Supabase functions)

To confirm Resend works without deploying anything:

1. In your project root `.env.local`, add:
   - `RESEND_API_KEY` — your Resend API key (starts with `re_`)
   - `RESEND_FROM_EMAIL` — e.g. `Friend Place <onboarding@resend.dev>` or your verified sender
2. From the project root run: `npm run dev`
3. In another terminal (or Postman):
   ```bash
   curl -X POST http://localhost:3000/api/notifications/test -H "Content-Type: application/json" -d "{\"to\":\"your@email.com\"}"
   ```
4. You should get `{"ok":true,"id":"..."}` and see the email in Resend’s dashboard and in the inbox. If you get an error, the response body will say why (e.g. missing key, invalid from address).

## Pre-flight checklist (before testing)

- [ ] Notifications migration applied (e.g. ran the SQL in Supabase SQL Editor, or `supabase db push`).
- [ ] Supabase Edge Function secrets set: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (and optionally `NOTIFICATION_CHANNEL=email`).
- [ ] Edge functions deployed: `supabase functions deploy notify-game-event` and `supabase functions deploy notify-stale-check`.
- [ ] **Results reminder:** `notify-stale-check` only considers games with `created_at` at least **1 hour** ago. For a quick test you can either wait 1 hour after creating a game, or temporarily call the function manually (see below).

## Test: results reminder (game finished, haven’t viewed)

1. **Two linked accounts** (email or Google) so Supabase Auth has an email for each.
2. **Create a game** (as user A), add user B by name, and claim B’s slot as user B. Complete placing and end the game (or wait for deadline) so the game is in **results**.
3. **As user B:** do **not** open the game’s results view (so B’s `game_players.results_viewed_at` stays null). User A can view results.
4. **Trigger the results reminder:**
   - **Option A (cron):** If Supabase cron is set to call `notify-stale-check` every 30 min, wait for the next run. The game must have been created **at least 1 hour ago** for the reminder to be sent.
   - **Option B (manual):** Call the function once (replace `<project-ref>` and, if required, an anon or service key in a header):
     ```bash
     curl -X POST "https://<project-ref>.supabase.co/functions/v1/notify-stale-check"
     ```
     If the function is behind auth, add: `-H "Authorization: Bearer <SUPABASE_ANON_KEY_or_SERVICE_ROLE_KEY>"`.
5. **Check:** User B’s email inbox for a personalized results-reminder email (and Resend dashboard for the send).

## Test: new game invite

1. User A creates a game and adds a **linked** user B (by name) and claims the slot as B (so `game_players` has a row with `player_id` = B’s user id).
2. **Database webhook** must be configured on `game_players` (INSERT) pointing to `notify-game-event`.
3. When the INSERT happens (e.g. when B is added and claimed), the function runs and should send B an email.
4. Check B’s inbox and Resend.

## Test: mid-game nudge

1. Create a game with several players; **2+ hours** after game creation, have at least **45%** of players submit.
2. Either the **database webhook** (on `game_players` UPDATE when someone submits) or the **cron** (calling `notify-stale-check`) will run.
3. Players who haven’t submitted and have an email (or phone if SMS) should get a nudge. Check inbox and Resend.

## Troubleshooting

### No record in Resend

1. **Secrets are in Supabase, not only .env.local**  
   Edge Functions run on Supabase and only see **Supabase secrets**. In Dashboard → Project Settings → Edge Functions → Secrets, set:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `ANTHROPIC_API_KEY` (for AI text)
   - Optionally `NOTIFICATION_CHANNEL=email`

2. **Function was never invoked**  
   - Results reminder: something must call `notify-stale-check` (cron or manual curl). If you never set up cron and never called it, no email is sent.
   - New game invite: the `game_players` INSERT webhook must point to `notify-game-event`. If the webhook isn’t set or the URL is wrong, the function won’t run.

3. **Results reminder: 1-hour rule**  
   `notify-stale-check` only sends results reminders for games where `games.created_at` is **at least 1 hour ago**. Newly finished games won’t get a reminder until an hour has passed (or you change the code / call the function with a test payload).

4. **No eligible recipient**  
   For email, the recipient must be a **linked** user (not anonymous) with an email in Supabase Auth. The function looks up the email via `auth.admin.getUserById(player_id)`.

5. **Check Edge Function logs**  
   Supabase Dashboard → Edge Functions → select `notify-stale-check` or `notify-game-event` → Logs. Look for errors (e.g. "RESEND_API_KEY is not set", "Resend API 403", or errors before the send).

### Other checks

- **No email in inbox:** Confirm recipient has an email in Supabase Auth (linked account). Check Resend dashboard for bounces/errors and Edge Function logs.
- **Results reminder never sent:** Ensure game is in `results`, `created_at` is at least 1 hour ago, and the player’s `game_players.results_viewed_at` is null. Then trigger `notify-stale-check` (cron or manual curl).
- **Webhook not firing:** In Supabase Dashboard → Database → Webhooks, confirm the `game_players` webhook is enabled and the URL is correct.
