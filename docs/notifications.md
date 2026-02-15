# Notification System

AI-generated reminders (email via Resend by default; optional SMS or browser push) for game events. Implemented with Supabase Edge Functions. Recipients are identified by **email** (from Supabase Auth) when using the email channel, or by **phone** (from `players.phone`) when using SMS.

## Triggers

1. **New game invite** — When a linked user is added to a game (`game_players` INSERT with `player_id` set), they receive an email (or SMS if channel is `sms`) with axis context (AI-generated).
2. **Mid-game nudge** — When ≥45% of players have submitted and the game started 2+ hours ago, remaining players get a teaser. Re-evaluated on each submission (DB webhook) and by cron.
3. **Results reminder** — When a game is in results and a player has not viewed results (and game created 1+ hour ago), they get a hint (cron).

## Database

- `players.phone` (optional, E.164) — used only when `NOTIFICATION_CHANNEL=sms`
- `players.notifications_enabled` (default true)
- `game_players.results_viewed_at` — set when the play page shows results
- `notification_log` — one row per (player, game, kind) for deduplication

## Edge Functions

- **`notify-game-event`** — Invoked by Database Webhooks on `game_players` (INSERT and UPDATE). Handles new-game-invite and mid-game-nudge when someone submits.
- **`notify-stale-check`** — Invoked by cron (e.g. every 30 min). Catches mid-game nudges and results reminders.

## Email (Resend) — default

Notifications are sent by **email** using [Resend](https://resend.com). Recipient email comes from the user’s Supabase Auth account (linked email/Google accounts). No extra column is needed on `players` for email.

### Resend setup

1. Create an account at [resend.com](https://resend.com) and add/verify a domain (or use `onboarding@resend.dev` for testing).
2. Create an **API key** (Resend dashboard → API Keys). Copy the key (starts with `re_`).
3. Set Supabase Edge Function secrets:
   - `RESEND_API_KEY` — your Resend API key
   - `RESEND_FROM_EMAIL` — sender address, e.g. `Friend Place <noreply@yourdomain.com>` or `Friend Place <onboarding@resend.dev>`
   - (Optional) `RESEND_SUBJECT_PREFIX` — prefix for the subject line (default: `Friend Place: `)

### Secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets)

**For email (default):**

- `ANTHROPIC_API_KEY` — for AI-generated message text
- `RESEND_API_KEY` — Resend API key
- `RESEND_FROM_EMAIL` — sender email (e.g. `Friend Place <noreply@yourdomain.com>`)
- `NOTIFICATION_CHANNEL` — `email` (default), or `sms` / `push`

**For SMS (optional):**

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Set `NOTIFICATION_CHANNEL=sms`

## Webhook and Cron Setup (Supabase Dashboard)

1. **Database Webhooks**  
   - Table: `game_players`  
   - Events: Insert, Update  
   - URL: `https://<project-ref>.supabase.co/functions/v1/notify-game-event`  
   - HTTP method: POST  

2. **Cron**  
   - Use Supabase Cron (or pg_cron) to call `notify-stale-check` every 30 minutes (POST or GET to the function URL).

## Switching to SMS or Browser Push

- **SMS:** Set `NOTIFICATION_CHANNEL=sms` and add Twilio secrets. Recipients are taken from `players.phone`; users must have a phone number set (e.g. on profile).
- **Push:** Set `NOTIFICATION_CHANNEL=push` and implement `_shared/push-channel.ts`: look up push subscription(s) for the player (e.g. from a `push_subscriptions` table), then send via the Web Push API.
