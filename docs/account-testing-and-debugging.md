# Testing and debugging the account system

This guide walks through how to test the current account flow and where to look when something goes wrong.

---

## 1. Prerequisites

### Environment variables

In `.env.local` (project root) you need:

- **`NEXT_PUBLIC_SUPABASE_URL`** – Supabase project URL (e.g. `https://xxx.supabase.co`)
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** – Supabase anon/public key
- **`SUPABASE_SERVICE_ROLE_KEY`** – Required for the **merge API** (`POST /api/account/merge`). Without it, merging anonymous data into a linked account will return 500.

Get these from [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Settings** → **API**.

### Supabase Auth config

In **Authentication** → **Providers**:

- **Anonymous** – Enabled (so users can play without signing in).
- **Email** – Enabled if you want email/password sign-in. Optionally enable “Confirm email” so new users verify via link.
- **Google** (or other OAuth) – Enable and set redirect URL to `http://localhost:3000/auth/callback` for local dev (or your production origin + `/auth/callback`).

Add `http://localhost:3000/auth/callback` (and your production URL) under **Authentication** → **URL Configuration** → **Redirect URLs**.

### Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## 2. Test scenarios (step-by-step)

### A. Anonymous play (no account)

1. Open `http://localhost:3000` in a **fresh** browser (or incognito) so there’s no existing session.
2. You should be signed in **anonymously** automatically. The nav should **not** show “My games”, “Profile”, or your email (no linked account).
3. Create a game, join with another device/link, play through. This creates rows in `games`, `game_players`, `players`, etc. tied to the anonymous `auth.uid()`.

**What to check:** No “Sign in” in nav; game creation and play work. In DevTools → Application → Cookies (or Storage), you should see Supabase-related cookies.

---

### B. Sign in with email (new account)

1. From the same session (anonymous), go to a **finished** game’s results screen, or open the Auth modal from wherever it’s shown (e.g. “Sign in” if you add it on the home page).
2. Click **“Don’t have an account? Create one.”** Enter email, **Create password**, **Confirm password** (matching), then **Create account**.
3. If “Confirm email” is on: check your inbox (or Supabase Inbucket if using local Supabase), open the link. It should land on `/auth/callback?code=...` then redirect to `/`.
4. After sign-in, the nav should show **email**, “My games”, “Profile”, account icon, and “Sign out”.

**What to check:** Supabase Dashboard → **Authentication** → **Users**: you should see the user with that email and provider `email` (not `anonymous`).

---

### C. Sign in with Google

1. Open the Auth modal, click **“Continue with Google”**.
2. Complete Google sign-in. You should be redirected to `/auth/callback` then back to the app.
3. Nav should show your Google email (or name) and the same linked UI as above.

**What to check:** If redirect fails, check **Redirect URLs** in Supabase and that the callback URL is exactly `http://localhost:3000/auth/callback` (no trailing slash). Check browser console and Network tab for the redirect.

---

### D. Merge flow (anonymous → linked)

This flow attaches the **current device’s** anonymous game data to the account you just linked.

1. **Start anonymous:** In a fresh/incognito window, open the app. Create a game (or join one) and optionally play a bit so there’s data under the anonymous user.
2. **Open the sign-in modal** (e.g. from results screen after a game ends, or wherever `AccountPrompt` is shown).
3. **Sign in** with email or Google. Before redirect, the app stores the current anonymous user id in `localStorage` under `fp-pending-merge-anon-uid`.
4. After sign-in completes, **AuthMergeChecker** (in the root layout) sees: (a) current user is linked, (b) `fp-pending-merge-anon-uid` is set. It shows **MergeDataModal** (“You had progress on this device. Merge it into your account?”).
5. Click **Merge**. The app calls `POST /api/account/merge` with `{ fromUserId: "<anon-id>" }`. The server moves `games.created_by` and `game_players.player_id` from the anon id to the current user, then clears the key.
6. Page reloads; “My games” / “Profile” should now show the merged game(s).

**What to check:**

- Before signing in, in DevTools → Application → Local Storage, you should **not** see `fp-pending-merge-anon-uid` until you click “Sign in” / “Continue with Google” (it’s set right before the auth action).
- After sign-in, you should see the merge modal once, then the key is removed. If you don’t see the modal, see “Debugging” below.

---

### E. Account and “My games” pages

1. While **signed in** (linked account), click **Profile** or the **account icon** in the nav → `/profile`.
2. You should see **Account** page: Score history (rank-only list), Profile records (e.g. extreme consensus).
3. Click **“My games”** in the nav → `/games`. You should see finished games where you participated, with your **rank** (no raw scores).

**What to check:** If you see “Sign in to see your game history”, the session is missing or `isLinked` is false (e.g. still anonymous). Check Supabase Auth and cookies.

---

## 3. Where to debug

### Browser DevTools

- **Application → Local Storage**  
  - `fp-pending-merge-anon-uid`: only set right before email/Google sign-in; cleared after merge or dismiss. If merge modal doesn’t appear, confirm this key exists **after** sign-in and that the value is a UUID.

- **Application → Cookies**  
  - Supabase stores the session in cookies (via `@supabase/ssr`). If you don’t see Supabase-related cookies after sign-in, check middleware and cookie domain/path.

- **Network tab**  
  - When you click “Merge”, look for `POST /api/account/merge`. Check status (200 vs 401/403/500) and response body.
  - For sign-in: `POST .../auth/v1/token?grant_type=password` (email) or redirect to Google then `.../auth/v1/token?grant_type=...` (callback).
  - For OAuth: redirect to Supabase → Google → back to `/auth/callback?code=...` then `exchangeCodeForSession`.

- **Console**  
  - Errors from Supabase client or failed fetches. Any “Unauthorized” or CORS issues.

### Supabase Dashboard

- **Authentication → Users**  
  - See anonymous vs email/OAuth users. After sign-in you should see provider `email` or `google`, not `anonymous`.
  - User ID (UUID) is what we use as `players.id`, `games.created_by`, `game_players.player_id`.

- **Authentication → Logs**  
  - Failed/successful logins, token exchanges, and redirects. Helps with “nothing happens” or “redirect loop”.

- **Table Editor**  
  - **players**: one row per `auth.uid()` (anon or linked). After merge, the anon `players` row is deleted and `linked_at` set on the linked user’s row.
  - **games**: `created_by` should point to the linked user after merge.
  - **game_players**: `player_id` should point to the linked user after merge.

### Server-side (merge API)

- **Logs:** Add `console.log` in `app/api/account/merge/route.ts` (or use a logger) to log `currentUser.id`, `fromUserId`, and each step’s result. In dev, `next dev` prints these to the terminal.
- **Service role key:** If merge returns 500 “Server configuration error”, `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong. Merge **must** use the service role to call `auth.admin.getUserById(fromUserId)` and to update/delete rows across users.

### Auth state in the app

- **`lib/use-auth.ts`**  
  - Exposes `user`, `loading`, `isAnonymous`, `isLinked`. `isLinked = !!user && !isAnonymous`. If the UI thinks you’re still anonymous after sign-in, Supabase may still be returning `provider: 'anonymous'` (e.g. session not refreshed). Try hard refresh or re-sign-in.

- **`app/auth/callback/route.ts`**  
  - Only runs after OAuth redirect. It exchanges `code` for a session and redirects. If you land on `/auth/callback` but then see “error=auth” or no session, check Supabase Auth logs and that the code wasn’t already used or expired.

---

## 4. Common issues and fixes

| Symptom | What to check |
|--------|----------------|
| “Sign in” / form does nothing | Network tab for failed auth request; Supabase Auth → Logs. Confirm Email (and Google) providers are enabled. |
| Redirect after Google goes to wrong URL or error | Redirect URLs in Supabase (exact match). Callback is `origin + /auth/callback`. |
| Merge modal never appears | (1) You must have been anonymous **before** opening the sign-in modal. (2) After sign-in, `fp-pending-merge-anon-uid` must be in localStorage (set when you clicked sign-in). (3) AuthMergeChecker only runs when user is **linked** and key exists. Check in DevTools. |
| Merge returns 401 | No session cookie (not signed in). Ensure cookies are sent: `credentials: 'include'` on the fetch (already in AuthMergeChecker). |
| Merge returns 403 “Sign in with email or Google first” | Current user is still anonymous. Sign in with email or Google so `is_anonymous` is false. |
| Merge returns 403 “Can only merge anonymous session data” | The `fromUserId` you sent is a real (linked) user. Only anonymous user IDs are allowed. |
| Merge returns 404 “User not found” | The anon user may have been deleted, or the UUID is wrong. Confirm the value in `fp-pending-merge-anon-uid` matches an existing user in Supabase Auth. |
| Merge returns 500 | Server logs for the actual error. Often missing `SUPABASE_SERVICE_ROLE_KEY` or Supabase API error (e.g. RLS or DB error). |
| Profile / My games show “Sign in to see…” when I am signed in | Session might be stale or not recognized. Check cookies; try sign out and sign in again. Confirm in Supabase Auth that the user is not anonymous. |
| Email confirmation link doesn’t work | In Supabase, set “Site URL” and “Redirect URLs” correctly. Confirmation link uses `emailRedirectTo`; it must be allowlisted. |

---

## 5. Quick reference: key files

- **Auth UI:** `components/AuthModal.tsx` (email + Google), `components/AccountPrompt.tsx` (prompt on results).
- **Auth state:** `lib/use-auth.ts` (`user`, `isLinked`).
- **Merge flow:** `components/AuthMergeChecker.tsx` (shows modal), `components/MergeDataModal.tsx` (UI), `app/api/account/merge/route.ts` (API).
- **Storage key:** `lib/auth-constants.ts` → `PENDING_MERGE_ANON_UID_KEY` = `"fp-pending-merge-anon-uid"`.
- **Callback:** `app/auth/callback/route.ts` (OAuth code exchange).
- **Protected pages:** `app/profile/page.tsx`, `app/games/page.tsx` (redirect or “Sign in to see…” when not linked).

Using this, you can run through each scenario and narrow down any failure to auth, redirect, merge API, or session/cookies.
