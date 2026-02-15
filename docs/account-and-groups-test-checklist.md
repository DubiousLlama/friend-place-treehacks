# Account and Groups — Feature List & Test Checklist

Use this list to verify that account and groups features work end-to-end. Assume you have a **linked account** (signed in with email or OAuth) for full access.

---

## 1. Schema & data (one-time)

**Features:** `games.group_id`, `group_members`, `saved_groups` settings, `user_featured_tags`, RLS for members.

**How to test:**
- Run migrations: `npx supabase db push` (or apply `20260215100000_groups_and_tags.sql`).
- In Supabase Dashboard → Table Editor, confirm:
  - `games` has `group_id` (nullable).
  - `saved_groups` has `anyone_can_add_members`, `only_admin_can_remove`, `daily_game_enabled`, and `name` nullable.
  - `group_members` and `user_featured_tags` exist.
- If you had existing `saved_groups`, each should have at least one row in `group_members` (owner backfilled).

**Seeding fake groups and games (optional):**
- Get your auth user UUID: Supabase Dashboard → Authentication → Users, or run `SELECT auth.uid();` in SQL Editor while logged in.
- Open `supabase/seed.sql`, replace `00000000-0000-0000-0000-000000000000` with your UUID, then run the file in Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run). This inserts two groups (“Weekend Crew”, “Office Friends”), one active (placing) game, two finished (results) games, and some game_players/guesses so the profile and group pages have data to show.

---

## 2. Top bar & navigation

**Features:** Account name/icon links to profile from anywhere; Groups link in nav; Profile link.

**How to test:**
- While signed in, from home, games, or play page: click the **account icon + email** in the top right → should go to `/profile`.
- Click **Groups** in the nav → should go to `/profile/groups`.
- Click **Profile** → should go to `/profile`.

---

## 3. Profile (account) page

**Features:** Header with Groups icon (left), title (center), Settings icon (right). Display name and email. Tags, Current games, Past games.

**How to test:**
- Go to `/profile`.
- **Header:** Left icon → `/profile/groups`. Right icon → `/profile/settings`. Title shows display name or "Account".
- **Tags:** See featured tags if any; click **+** to open “Add tag” modal, pick a tag from past games, confirm it appears; click **×** on a tag to remove.
- **Current games:** If you have games in “placing” phase, they appear in two horizontal rows; each card shows axes, group name (or "—"), and group streak when > 0. Scroll horizontally; click a card → `/play/{inviteCode}`.
- **Past games:** Finished games listed as “axes · group name · your rank”; click → game results.

---

## 4. Settings page

**Features:** Edit display name, see account email, sign out.

**How to test:**
- Profile → Settings (gear).
- Change display name, click **Save** → success message; reload profile → new name in header.
- **Sign out** → redirect home; nav no longer shows account/Groups/Profile (or shows sign-in).

---

## 5. Tags (computation & featured)

**Features:** Candidate tags from past games (axis-end + agreement %); add/remove featured tags; persistence in `user_featured_tags`.

**How to test:**
- Finish at least one game (phase = results) where others guessed you; go to profile.
- **Tags section:** If you have such games, candidate tags appear in “Add tag” modal (e.g. “Gimli 85%”).
- Add 1–2 tags → they show as chips; refresh page → still there.
- Remove a tag → it disappears; refresh → still gone.

---

## 6. Per-group streak

**Features:** Streak = consecutive days with at least one game in that group. Shown on profile current-game cards and on group page.

**How to test:**
- Create two games in the same group on different days (or same day for streak 1). Set `games.group_id` to the same group for both (e.g. via SQL or by creating both from that group on home).
- Profile → Current games: card for that group shows “X-day streak” when X ≥ 1.
- Open group page → streak shown under the group name when > 0.

---

## 7. Current games (two rows, group name, streak)

**Features:** Horizontal scroll, two rows in sync; group name per card; per-group streak.

**How to test:**
- Have at least one game in “placing” where you’re a player (and optionally `group_id` set).
- Profile → Current games: two rows of cards, same horizontal scroll; each card shows group name (or "—") and streak when applicable.

---

## 8. Past games (axes · group · rank)

**Features:** Past games listed as axes, group name, your rank; link to game.

**How to test:**
- Have at least one finished game (phase = results) you participated in.
- Profile → Past games: each row shows axes label, group name (or "—"), “You placed Xth of Y”, date. Click → `/play/{inviteCode}` (results view).

---

## 9. Groups list page

**Features:** List groups you’re in; leave group; owner leave auto-assigns new owner.

**How to test:**
- Go to `/profile/groups`. If you have no groups, see empty state.
- After creating a group (from results or backfill): group appears with name (or member list). Click name → group page.
- **Leave:** Click **Leave** on a group → you’re removed; list updates. If you were owner, another member becomes owner (check `saved_groups.owner_id` or have another member confirm they’re now owner).

---

## 10. Group detail page

**Features:** Chronology (two rows, active first, then past); winner in trophy with initials; members (crown, incognito, games won, add/remove, three-dot menu); edit group name; settings (permissions + daily email toggle); leave group; copy group link.

**How to test:**
- Open a group from `/profile/groups` or directly `/groups/{id}`.
- **Chronology:** Two horizontal rows of game cards; placing games first, then results. Each card: date in corner, trophy with winner initials, axes. Click card → play page.
- **Members:** Owner has crown; anonymous members have incognito icon; “X wins” per member. **Add:** If allowed, click Add → enter name → Add → new row (anonymous). **Remove / Transfer:** Open three-dot menu on a member → Remove or (owner only) Transfer ownership; confirm behavior.
- **Group name:** Click **Edit name** → change → Save → title updates; refresh → persists.
- **Settings (owner only):** Toggle “Anyone can add members”, “Only admin can remove members”, “Daily game email reminders” → Save settings; reload → toggles persist.
- **Leave group:** Click **Leave group** → confirm; redirect to `/profile/groups`; if you were owner, new owner assigned.
- **Copy group link:** Click **Copy group link** → “Copied!”; paste in new tab (while signed in as same member) → group page loads.

---

## 11. Create group from results

**Features:** After a game ends, “Create group from this game”; optional name; then “Create a recurring daily game? We’ll send email reminders…” Yes/No; group created with owner + members (anonymous where no `player_id`).

**How to test:**
- Finish a game (phase = results) and go to results view (e.g. `/play/{inviteCode}`).
- While **signed in (linked):** see **Create a group** section. Click **Create group from this game**.
- Enter a group name (or leave blank) → **Create**. Group is created; prompt appears: “Create a recurring daily game? We’ll send email reminders…”.
- Click **Yes** → `saved_groups.daily_game_enabled` = true for that group (check in DB or on group page settings). Click **No** → daily_game_enabled stays false.
- Go to **Groups** → new group appears. Open group → members match game players (you as owner, others as members; anonymous where no account).

---

## 12. Daily game cron job

**Features:** Cron calls `/api/cron/daily-games`; for groups with `daily_game_enabled = true`, creates today’s game (daily axes) and game_players from group_members; logs (or later sends) reminder emails.

**How to test:**
- Set `CRON_SECRET` in env (e.g. in Vercel or `.env.local`).
- In Supabase, set at least one group: `daily_game_enabled = true`.
- Call the endpoint with the secret (local or deployed):
  - `curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-app.vercel.app/api/cron/daily-games"`  
  - Or locally: `curl -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:3000/api/cron/daily-games"`.
- Response: `{ "created": 1, "today": "YYYY-MM-DD", "emailsQueued": N }`.
- In DB: new row in `games` with `group_id` set, `phase = 'placing'`, and today’s daily axes; `game_players` rows for each group member.

---

## 13. Create game from group

**Features:** On home, when a group is selected, member list is from `group_members`; on create, `games.group_id` is set so the new game is linked to the group.

**How to test:**
- Home → under “Create a game”, select a **saved group** from the dropdown (if you have one).
- Confirm the **player names** pre-fill from that group’s members (from `group_members`).
- Create the game (axes, end time, etc.) → submit.
- After redirect to play page, in DB: that game has `group_id` = selected group. On profile → Current games, that game shows with the group name and streak.

---

## 14. Persistent group link & copy link

**Features:** Group page URL is `/groups/{id}` (stable); “Copy group link” copies it for sharing.

**How to test:**
- Open a group (e.g. from Groups list). URL is `https://your-origin/groups/{uuid}`.
- Bookmark or paste URL in another tab (same browser, same user) → same group page.
- Click **Copy group link** → paste elsewhere → link is the same `/groups/{id}`. Another member with the link can open it and see the group (if they’re in `group_members`).

---

## Quick reference: main routes

| Route | Purpose |
|-------|--------|
| `/profile` | Account page (name, tags, current games, past games) |
| `/profile/settings` | Display name, sign out |
| `/profile/groups` | List your groups, leave group |
| `/groups/[id]` | Group detail (games, members, settings, leave, copy link) |
| `/play/[inviteCode]` | Game play or results; results show “Create group” when linked |
| `/` | Home; create game, optionally from group |
| `/games` | My games (existing list) |

---

## Auth requirements

- **Linked account required** for: profile, settings, groups list, group page (as member), create group from results, create game from group with group selected.
- **Anonymous:** Can still play games via invite link; cannot see profile/groups or create groups.

If something doesn’t match this list, check: migrations applied, RLS policies, and that you’re signed in with a linked account (not anonymous).
