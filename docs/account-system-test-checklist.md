# Account system — test checklist

Use this to verify the account system end-to-end. For debugging details see [account-testing-and-debugging.md](account-testing-and-debugging.md).

---

## Before you start

- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Supabase: **Anonymous** and **Email** providers enabled; **Redirect URLs** includes `http://localhost:3000/auth/callback`
- [ ] If using email confirmation: custom SMTP configured (or “Confirm email” turned off for dev)
- [ ] `npm run dev` running; open `http://localhost:3000`

---

## 1. Anonymous play (no account)

- [ ] Open app in **incognito** or fresh window
- [ ] Nav does **not** show “My games”, “Profile”, or email (you’re anonymous)
- [ ] Create a game → works
- [ ] Join/play a game → works (optionally finish a game so you have results to use later)

---

## 2. Create account (email + password)

- [ ] From results screen (or wherever AccountPrompt appears), open **Sign in** modal
- [ ] Click **“Don’t have an account? Create one.”**
- [ ] Enter email, **Create password**, **Confirm password** (matching); click **Create account**
- [ ] If confirmation is on: receive email, click link → lands on app (e.g. `/auth/callback` then `/`)
- [ ] Nav now shows your **email**, “My games”, “Profile”, account icon, “Sign out”

---

## 3. Sign in (existing email account)

- [ ] Sign out (or use a new incognito window)
- [ ] Open Sign in modal → enter same email + password → **Sign in**
- [ ] Nav shows email and linked UI again

---

## 4. Merge (anonymous data → account)

- [ ] **New incognito window** → open app (you’re anonymous)
- [ ] Create or join a game, play a bit (so there’s data for this anon user)
- [ ] Go to **results screen** of a finished game (or wherever the “Save your progress” prompt is)
- [ ] Click **Sign in** → sign in with **email** or **Google**
- [ ] After sign-in, **Merge modal** appears: “You had progress on this device. Merge it?”
- [ ] Click **Merge** → page reloads
- [ ] **Profile** or **My games** shows the game(s) you just had as anonymous

---

## 5. Account & My games pages

- [ ] While signed in, click **Profile** (or account icon) → **Account** page loads
- [ ] **Score history** section shows your games (rank only) and “View all games →”
- [ ] **Profile records** section shows (e.g. extreme consensus) or “Play more games…”
- [ ] Click **My games** in nav → list of finished games with your **rank** (no scores)
- [ ] Sign out → **Profile** / **My games** redirect or show “Sign in to see…”

---

## 6. Google sign-in (if enabled)

- [ ] Open Sign in modal → **Continue with Google**
- [ ] Complete Google flow → redirect back to app
- [ ] Nav shows Google identity and linked UI
- [ ] **Profile** / **My games** work as above

---

## 7. Edge cases (optional)

- [ ] **Confirm password mismatch:** Create account with different “Confirm password” → error “Passwords don’t match.”
- [ ] **Wrong password on sign in:** Error from Supabase shown in modal
- [ ] **Merge then dismiss:** Choose “Dismiss” on merge modal → key cleared, no merge; your existing account data unchanged

---

## Done

If all checked, the account system (anonymous play, email sign-up/sign-in, merge, account pages) is working. For failures, see [account-testing-and-debugging.md](account-testing-and-debugging.md) (common issues, DevTools, Supabase dashboard).
