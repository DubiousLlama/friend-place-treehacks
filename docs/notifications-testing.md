# Testing the notification system

## How it deploys

- **Vercel** (via merge to `main`): deploys the **Next.js app** (profile, play page with `results_viewed_at`, AuthModal, etc.). The app does not run the notification logic.
- **Supabase**: **Edge Functions** (`notify-game-event`, `notify-stale-check`) run on Supabase. Deploy them with `supabase functions deploy`. Database webhooks and cron also live in Supabase.

So after merging to main you have the latest app on Vercel. Notifications only work after you deploy the edge functions and configure webhooks/cron in Supabase.

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

- **No email:** Confirm recipient has an email in Supabase Auth (linked account). Check Resend dashboard for bounces/errors. Check Edge Function logs in Supabase Dashboard → Edge Functions → Logs.
- **Results reminder never sent:** Ensure game is in `results`, `created_at` is at least 1 hour ago, and the player’s `game_players.results_viewed_at` is null. Then trigger `notify-stale-check` (cron or manual curl).
- **Webhook not firing:** In Supabase Dashboard → Database → Webhooks, confirm the `game_players` webhook is enabled and the URL is correct.
