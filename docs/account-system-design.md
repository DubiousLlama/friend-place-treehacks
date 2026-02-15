# Account System Design — Friend Place

This document brainstorms how a **persistent account system** could look for Friend Place, aligned with the [game plan](.cursor/plans/friend_place_game_plan_fd997aac.plan.md): **anonymous-first play**, with an **optional upgrade** so users can save history and recreate game groups.

---

## 1. Design principles (from the plan)

- **No sign-up to play.** Users open a link → anonymous sign-in → claim a name → play. No email or password required.
- **Upgrade at the right moment.** After the game ends (results screen), prompt: “Create an account to save your scores and easily replay with the same group.”
- **One identity, same ID.** Supabase [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) keeps the same `auth.uid()` when linking email/OAuth. All existing `players`, `games`, `game_players`, and `guesses` rows stay attached to that user — no data migration.

---

## 2. What “having an account” gives you

| Benefit | Description |
|--------|-------------|
| **Score history** | See past games and scores in one place (e.g. “My games” / “History”). |
| **Stable identity** | Same `player_id` across devices and sessions; friends see “you” consistently. |
| **Recreate game groups** | Save a named group (e.g. “Roommates”, “Work”) and start a new game with one tap. |
| **Daily / recurring games** | Optional: “Play again with same axes” or use daily axes for a recurring group. |
| **Recovery** | Log in on a new device and see your games; no dependency on a single browser. |

The app can stay **fully playable without an account**; these are reasons to *opt in*.

---

## 3. Auth flow (Supabase)

### 3.1 Current (already in place)

1. User hits `/` or `/play/[inviteCode]`.
2. No session → `signInAnonymously()`.
3. `auth.uid()` is used everywhere: `players.id`, `games.created_by`, `game_players.player_id`.
4. Session lives in localStorage; clearing it creates a *new* anonymous user (no recovery).

### 3.2 Upgrade path (Phase 5 and beyond)

**Option A — Link OAuth (e.g. Google)**

- User taps “Save my progress — sign in with Google.”
- Call `supabase.auth.linkIdentity({ provider: 'google' })`.
- Redirect to Google → back to app; same `auth.uid()`, now with a linked identity.
- No extra tables; `auth.users` gains the identity.

**Option B — Link email (required password)**

- User signs up with email + password via `signUp({ email, password })`. Password is **required**; we also collect “Create password” and “Confirm password” and validate they match before submitting. Supabase sends a verification email; after the user clicks the link they are identified.
- Existing users sign in with `signInWithPassword({ email, password })`.

**Recommendation:** Offer both: “Continue with Google” and “Continue with email.” Email sign-up uses required password plus confirm-password validation for security.

**Config:** In Supabase Dashboard → Auth → Providers, enable Anonymous sign-in and “Confirm email” (and any OAuth providers). For linking, ensure [manual linking](https://supabase.com/docs/guides/auth/auth-identity-linking) is enabled as needed.

---

## 4. Data model implications

### 4.1 What stays the same

- **`players.id` = `auth.uid()`** — No change. After linking, the same UUID is still the user.
- **`players.display_name`** — Can stay as “last used name” or become a global “preferred display name” (see below).
- All RLS policies that use `auth.uid()` continue to work; no migration for “anonymous → linked.”

### 4.2 Optional: “Has account” flag

If you want to show different UI or analytics for “has linked identity”:

- **Option 1 (recommended):** Infer from Supabase Auth. Check `user.app_metadata.provider !== 'anonymous'` or presence of `user.email` / identities. No schema change.
- **Option 2:** Add `players.linked_at timestamptz` and set it in a DB trigger or API when you detect a linked identity. Lets you query “all users who upgraded” in SQL.

Start with Option 1; add Option 2 only if you need it for queries or product logic.

### 4.3 Optional: Global display name

Today `players.display_name` is set at game creation or name claim and can differ per game (`game_players.display_name` is per game). For “account” users you could:

- Treat `players.display_name` as a **default** when creating/claiming: “Use this name in new games?”
- Keep per-game overrides in `game_players.display_name` so names can still be game-specific.

No schema change required; just UX: “Use [X] as your name in new games?” and upsert `players.display_name` when they confirm.

---

## 5. New features that depend on “account”

### 5.1 “My games” / History

- **Query:** Games where `games.created_by = auth.uid()` OR `game_players.player_id = auth.uid()`.
- **Page:** e.g. `/games` or `/history` (optional; could also be a section on `/` when logged in with a linked identity).
- **RLS:** Already covered: users can read their own games and game_players; no new policies if you use existing tables.

### 5.2 Saved groups (“Play again with same crew”)

- **New table (optional):** e.g. `saved_groups`:
  - `id`, `owner_id` (→ `players.id`), `name` (e.g. “Roommates”), `created_at`.
- **Group members:** e.g. `saved_group_members`: `group_id`, `display_name` (and optionally `player_id` if they’re a known player).
- **Flow:** After a game ends, “Save this group?” → name it → next time “Start game” can offer “Use saved group: Roommates” and pre-fill player names.
- **Scope:** Only for users with a linked account (`auth.uid()` with email or OAuth). Anonymous users don’t see “Save group” or “Use saved group.”

### 5.3 Daily / recurring axes

- You already have `daily_axes`; “account” doesn’t change that. Optional: “Start today’s game with [saved group]” for one-tap daily games with the same friends.

---

## 6. UI/UX flow

### 6.1 Where to prompt for account creation

- **Primary (per plan):** Results screen — after scores and placement reveal. “Save your progress — create an account so you can see your history and replay with the same group.”
- **Secondary:** Optional soft prompt on dashboard (“Create an account to never lose your games”) or once when they create a second game as anonymous (e.g. “You’ve created 2 games — sign in to find them all in one place”).

Avoid prompting before they’ve played or mid-game; keep the first experience frictionless.

### 6.2 AccountPrompt and AuthModal (Phase 5)

- **Copy:** Emphasize benefits: score history, same group again, play from any device.
- **Actions:** “Continue with Google”, or email form with “Don’t have an account? Create one.” (toggles to sign-up). Sign-up: email, **Create password**, **Confirm password** (must match), **Create account** button. Sign-in: email, **Password**, **Sign in** button.
- **After link:** Short confirmation (“You’re all set. Your games are saved.”) and optionally redirect to a “My games” view or back to the same results page with prompt dismissed.

Dismissal: store in `localStorage` or in DB (“user dismissed account prompt at …”) so you don’t nag every time; still show “My games” / “Sign in” in header when they have no linked account.

### 6.3 Signed-in experience

- **Header / nav:** If `user` has linked identity: “My games”, “Profile”, **account icon** (links to account page), email label, sign out. If anonymous: no “My games”, or show “Sign in to save games.”
- **Home `/`:** If signed in, show “My games” list and “Create game”; optionally “Start from saved group.” If anonymous, current flow: just “Create game.”

---

## 7. Implementation order (suggested)

| Step | What | Depends on |
|------|------|------------|
| 1 | **AccountPrompt on results** | Phase 5 results UI. Use `linkIdentity({ provider: 'google' })` and sign up / sign in with email + verification. |
| 2 | **Detect “has account”** | Check `user` identities/email in client; optionally set `players.linked_at` via trigger or API. |
| 3 | **“My games” page** | Query games by `created_by` and by `game_players.player_id`; RLS already allows this. |
| 4 | **Default display name** | Use `players.display_name` when creating/claiming; add one-time “Use this name in new games?” after link. |
| 5 | **Saved groups** | New tables + “Save this group?” on results + “Start from group” on home. |
| 6 | **Recurring / daily with group** | “Today’s game with [group]” using `daily_axes` + saved group names. |

You can ship 1–3 first (account creation + history), then add 4–6 as polish.

---

## 8. Edge cases and decisions

- **Multiple anonymous sessions:** Each device/browser has a different anonymous `auth.uid()`. No merge. Once they link on one device, that device has the “real” account; others stay anonymous until they sign in there too. Acceptable for MVP.
- **Linking with an email that already has an account:** Supabase can either link (same user, two identities) or error “email already in use” depending on config. Prefer “email already in use” and offer “Sign in” so you don’t merge two different people’s anonymous histories.
- **Sign out:** After sign-out, they’re a new anonymous user. Don’t auto-sign-out; only on explicit “Sign out.” Optionally: “Sign out on this device only.”
- **Deletion / GDPR:** Supabase supports user deletion; add a “Delete my account” that uses the Auth API and optionally anonymizes or deletes `players` / related data per your policy.

Security and privacy for login, callback, and merge are documented in [Security and privacy](security-and-privacy.md).

---

## 9. Summary

- **Account = linked Supabase identity** (email or OAuth); same `auth.uid()`, so no data migration. For future reminder texts, `lib/sms/` provides a swappable SMS provider (e.g. Twilio).
- **Anonymous-first** stays; account is optional and prompted after results (and optionally elsewhere).
- **First deliverables:** AccountPrompt (Phase 5), then “My games” and optional default display name.
- **Later:** Saved groups and “play again with same crew” for a sticky, recurring experience.

This keeps the plan’s low-friction entry while giving a clear path to persistent accounts and future features (history, groups, daily play) without breaking existing flows or schema.
