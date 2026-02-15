# Security and privacy — Account login and verification

This document describes security and privacy measures for the Friend Place account system (login, merge, callback). See also [Account system design](account-system-design.md).

---

## 1. Login and verification

- **Auth provider:** Supabase Auth handles all credentials; the app never stores passwords. Email/password and OAuth (e.g. Google) use Supabase’s built-in flows.
- **Session:** Supabase SSR stores the session in cookies; middleware refreshes it. Sensitive tokens are not stored in application localStorage (Supabase’s own client may use localStorage for session; we use cookie-based SSR where possible).
- **Callback redirect:** The `/auth/callback` route only redirects to **relative paths**. The `next` query param is sanitized: it must start with a single `/` and must not contain `//` or `\`, preventing open-redirect to external sites.

---

## 2. Merge endpoint (`POST /api/account/merge`)

- **Purpose:** When a user signs in with email/OAuth on a device that had anonymous play, they can merge that device’s anonymous data into their account. The client sends the previous anonymous `auth.uid()` (stored in localStorage before redirect).
- **Authorization:** The current user must be authenticated (session cookie) and must have a **persistent identity** (not anonymous). Anonymous users cannot call merge to “pull” another account’s data.
- **Validation:**
  - `fromUserId` must be a valid UUID string.
  - The server uses the **service-role** client to call `auth.admin.getUserById(fromUserId)`. Merge is allowed **only if** that user exists and **is anonymous**. If `fromUserId` refers to a real (linked) account, the request is rejected with 403. This prevents a logged-in attacker from stealing another user’s data by supplying a victim’s user ID.
- **Idempotent self-merge:** If `fromUserId === currentUser.id`, the API returns success without changing data.
- **Privacy:** Merge reassigns `games.created_by` and `game_players.player_id` from the anon ID to the current user, copies display name only when the current user has none, then deletes the anon `players` row. No extra data is exposed to the client beyond success/error.

---

## 3. Client-side merge flow

- **Pending merge ID:** The anonymous user ID is stored in localStorage under `fp-pending-merge-anon-uid` only **immediately before** starting OAuth or email sign-in. It is an opaque UUID; the server enforces that the ID must be anonymous before performing any merge.
- **Merge modal:** Shown only when the user is **linked** and the stored pending ID exists. The user can confirm (merge) or dismiss; either way the key is cleared. No automatic merge without user action.

---

## 4. Design trade-offs

- **No rate limit on merge:** Each account can trigger merge multiple times (e.g. merge device A, then later device B). Abuse is limited by the anonymous-only check. Optional future hardening: one merge per account (e.g. `players.merged_at`).
- **No server-side proof of “this device had that anon”:** We rely on “only allow merging from anonymous IDs” so that at worst an attacker could merge a *different* anonymous user’s data (low value; anon data is game-only). Real (linked) accounts cannot be merged into another user.

---

## 5. Recommendations

- Keep **Supabase redirect URLs** allowlisted in the dashboard (no wildcards to other domains).
- Use **HTTPS** in production; ensure `NEXT_PUBLIC_SUPABASE_URL` and callback URLs use HTTPS.
- For **email sign-up**, enable “Confirm email” in Supabase if you want verified addresses.
- **Service-role key** must only be used server-side (API routes); never expose it to the client.
