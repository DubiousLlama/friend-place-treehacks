# Full game QA guide

Use this checklist to verify every part of Friend Place is functional and polished. Work through sections in order for one full playthrough, then profile/auth and polish.

---

## Prerequisites

- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and `SUPABASE_SERVICE_ROLE_KEY` if using merge/APIs)
- [ ] Supabase project is running; Auth has Anonymous and Email (and optionally Google) enabled
- [ ] Redirect URLs include your app origin (e.g. `http://localhost:3000/auth/callback`)
- [ ] `npm run dev` is running; open your app URL (e.g. `http://localhost:3000`)

---

## 1. Home page

**Goal:** Nav, hero, and create-game form behave correctly.

- [ ] Nav shows "Friend Place" (bold, centered) and one account icon on the right
- [ ] When signed out: clicking the account icon opens the sign-in / create-account modal
- [ ] When signed in: clicking the account icon goes to the profile page
- [ ] Hero shows "Today's axes" (or loading state) and a sample graph with example players (e.g. Alex, Bob, Carol)
- [ ] Tapping or clicking the sample graph scrolls the page to the "Create a game" form
- [ ] The sample graph is not draggable or zoomable (overlay blocks interaction)
- [ ] Create game form: four axis fields are pre-filled with today's axes (when loaded)
- [ ] Your name field and friend name fields (add/remove) work
- [ ] End time and "End early when everyone's done" are present and submittable
- [ ] If signed in: saved groups dropdown appears and loading a group fills friend names
- [ ] Submitting the form with valid data creates the game and redirects to `/play/[inviteCode]`

---

## 2. Join flow (play page – unclaimed)

**Goal:** New visitors can open a link and claim a name.

- [ ] Opening an invalid or missing invite code shows "Game not found" and a back-home link
- [ ] Opening a valid invite link for the first time shows **NameSelector**
- [ ] NameSelector lists unclaimed name slots as tappable options
- [ ] "I'm not on the list" (or equivalent) lets the user type a new name and join
- [ ] After claiming a name, the user lands in the placing phase (graph or dashboard depending on state)

---

## 3. Placing phase (graph view)

**Goal:** User can place self, place friends, and submit; info panel and share work.

- [ ] **Step "self":** One draggable pill shows the user's display name; user can place it on the graph
- [ ] On first-ever play, onboarding popup #1 appears (and can be dismissed)
- [ ] **Step "others":** Token tray shows friend names; user can drag each onto the graph
- [ ] Onboarding popup #2 appears only after self is placed and step is "others" (if applicable)
- [ ] Submit button shows appropriate copy: "Place friends, then submit" / "X of N placed" / "Submit placement" or "Submit placements" (no "Submit all 1 placement")
- [ ] Game info panel (or toggle) opens and shows: invite link, copy button, player list with status (e.g. "2/4 placed"), deadline, edit name, switch name (unclaim)
- [ ] For the current user, status shows placement progress (e.g. "2/4 placed"); for others, "X/N placed" (not "Self placed")
- [ ] Host sees "End game & reveal results" in the panel; non-host does not
- [ ] Share / copy button copies the full invite message with exactly one URL (paste somewhere and confirm no duplicate link)

---

## 4. After submit (dashboard view)

**Goal:** Dashboard shows progress, continue placing, add players; realtime updates.

- [ ] After submitting placements, view switches to dashboard (card view)
- [ ] Card shows "You're all set" or "Placed X of N friends" as appropriate
- [ ] Edit name and Switch name (unclaim) are available and work
- [ ] "Continue placing" returns to the graph with existing guesses pre-loaded; user can move/add and submit again
- [ ] Add players section allows adding new name slots; after adding, user can go to graph and place them
- [ ] Invite link and copy button are present and work
- [ ] Player list shows placement counts (e.g. "3/4 placed") for each player
- [ ] Host sees "End game & reveal results" with confirmation
- [ ] When another player submits, their progress (e.g. "3/4 placed") updates without refresh (realtime)

---

## 5. Results phase

**Goal:** Results view shows positions, scores, rankings; save group and share; links work.

- [ ] When the game is in results phase, **ResultsView** shows: graph with all positions, scores, rankings
- [ ] If signed in: option to save the group is present and works
- [ ] Share button works (copy or native share)
- [ ] If anonymous: account prompt (e.g. "Sign in to save progress") is shown
- [ ] Opening results sets `results_viewed_at` (so results-reminder emails are not sent again for that player)
- [ ] From profile or games list, link to the play page (e.g. `/play/ABC123`) opens and shows results

---

## 6. Profile and account

**Goal:** Profile page and account icon behave correctly; auth and merge optional.

- [ ] When signed in, profile page shows: score history (and "View all games" link), profile records (e.g. extreme consensus)
- [ ] Profile has optional phone field and "Send game reminders" toggle (saves correctly)
- [ ] Account icon in nav: signed out opens Auth modal; signed in links to profile
- [ ] Auth modal: sign in (email/password), create account (email, password, confirm, optional phone), toggle between sign in / create account
- [ ] For merge flow (anonymous → sign in): see [account-system-test-checklist.md](account-system-test-checklist.md)

---

## 7. Host and multi-player

**Goal:** Two+ players can play; host can add players and end game; all see results.

- [ ] Host can add players from the dashboard and see everyone's placement counts
- [ ] Host can end the game (with confirmation); game phase flips to results
- [ ] Second user (different device or incognito): opens invite link → NameSelector → claims a different name → places and submits
- [ ] Both users see each other's progress (e.g. "2/2 placed") without refresh
- [ ] After host ends game, both users see ResultsView
- [ ] For email notifications when game ends or reminders: see [notifications-testing.md](notifications-testing.md)

---

## 8. Polish and edge cases

**Goal:** Wording, graph styling, and edge cases are correct.

- [ ] Copy/share: pasted message is one line of text plus one URL (no duplicate link)
- [ ] Submit button never says "Submit all 1 placement"; says "Submit placement" or "Submit placements"
- [ ] Other players' status shows "X/N placed", not "Self placed"
- [ ] Graph: self dot is larger with a ring; friend dots are slightly smaller; labels are readable and do not overlap badly
- [ ] Game not found: clear message and visible back-home CTA
- [ ] Empty states (e.g. no saved groups, no score history) show friendly copy

---

## 9. Optional / reference

- **Notifications:** Resend test, Edge Function secrets, webhooks, cron — see [notifications-testing.md](notifications-testing.md).
- **Account merge and sign-in:** Full merge and auth checklist — see [account-system-test-checklist.md](account-system-test-checklist.md).
- **Component architecture:** How graph, dashboard, and auth pieces fit together — see [components.md](components.md).
