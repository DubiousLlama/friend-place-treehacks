# Supabase email setup (confirmation emails)

If confirmation emails from sign-up aren’t arriving (inbox or junk), it’s usually due to Supabase’s **default email limits** or missing **custom SMTP** configuration.

**Important:** Confirmation emails (sign-up, password reset) are sent by **Supabase Auth** using the **SMTP** settings in the Supabase Dashboard. They are **not** sent by your app or by the Resend API used for game notifications. So even if a test email from your app (e.g. `/api/notifications/test`) works with `auto@yourdomain.com`, you must still configure **Supabase → Authentication → SMTP** with Resend’s SMTP so Supabase can send auth emails from that address.

---

## Why emails don’t arrive

Supabase’s **built-in SMTP** is for testing only:

- **Rate limit:** about 2 emails per hour
- **Recipients:** often only **pre-authorized** addresses (emails you add in the dashboard)
- **Delivery:** no SLA; messages often go to spam or don’t deliver to personal inboxes

So unless you’ve set up **custom SMTP**, confirmation emails may never reach your inbox.

---

## Option 1: Custom SMTP (recommended for real use)

Use your own SMTP provider so Supabase sends auth emails (confirm, reset, etc.) through it.

1. **Open SMTP settings**  
   [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **SMTP** (or **Auth** → **Settings** → SMTP).

2. **Enable custom SMTP**  
   Turn on **“Enable Custom SMTP”** and fill in your provider’s details, for example:

   - **Sender email:** e.g. `noreply@yourdomain.com` (must be allowed by your provider).
   - **Sender name:** e.g. `Friend Place`.
   - **Host:** e.g. `smtp.resend.com` (Resend) or your provider’s SMTP host.
   - **Port:** usually `465` (SSL) or `587` (TLS).
   - **Username / password:** from your provider (often an API key as password).

3. **Use a free SMTP provider**  
   For a step-by-step free setup, see **[Free SMTP setup guide](free-smtp-setup-guide.md)** (Resend or Brevo). Supabase also works with any SMTP provider (SendGrid, Postmark, etc.): create an account, get host/port/username/password, and plug them in here.

4. **Save**  
   After saving, trigger a new sign-up and check that the confirmation email arrives (and check spam once).

Docs: [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

---

## Option 2: No confirmation for local/dev

If you only need to test and don’t care about verifying email yet:

1. **Turn off confirm email**  
   Supabase Dashboard → **Authentication** → **Providers** → **Email** → disable **“Confirm email”**.

2. **Result**  
   New users are created and signed in immediately; no confirmation email is sent. You can sign up and use the app without checking email.

Re-enable **“Confirm email”** when you want to use real confirmation again (and set up custom SMTP so those emails deliver).

---

## Redirect URL for the confirmation link

Your app sends `emailRedirectTo` to Supabase so the link in the email points back to your app. Supabase will only redirect to URLs that are allowlisted:

1. **Authentication** → **URL Configuration** (or **Redirect URLs**).
2. Add:
   - `http://localhost:3000/auth/callback` (local)
   - `https://yourdomain.com/auth/callback` (production)

Our callback route (`/auth/callback`) exchanges the token in the link for a session and then redirects; the link in the email will look like `https://your-project.supabase.co/...` and then redirect to one of these URLs.

---

## Quick checklist

- [ ] **Emails not arriving:** Set up **custom SMTP** (Option 1) or disable **Confirm email** (Option 2).
- [ ] **Link in email doesn’t work:** Add your app’s callback URL to **Redirect URLs** in Supabase.
- [ ] **Rate limit:** With custom SMTP you can adjust rate limits under Auth → Rate Limits if needed.

---

## Double-check when using Resend (e.g. auto@yourdomain.com)

If you already send test emails from your app with Resend and confirmation emails still fail:

1. **Supabase uses SMTP, not the Resend API**  
   In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **SMTP** (or Auth → Settings):
   - [ ] **Enable Custom SMTP** is turned on.
   - [ ] **Sender email:** exactly the address you use in Resend (e.g. `auto@wanderinglibrary.com`). Use only the email; Supabase often has a separate “Sender name” field.
   - [ ] **Host:** `smtp.resend.com`
   - [ ] **Port:** `465` (SSL) or `587` (TLS). Try 465 first if you get connection errors.
   - [ ] **Username:** `resend` (literal)
   - [ ] **Password:** your Resend API key (the `re_...` key). No spaces; copy again if it was truncated.

2. **Resend: domain and sender**  
   - [ ] In Resend → **Domains**, the domain in your sender (e.g. `wanderinglibrary.com`) is **Verified**. Until the domain is verified, you can’t send from `auto@wanderinglibrary.com` (except possibly to your own email in some cases).
   - [ ] After domain verification, any address `*@wanderinglibrary.com` is allowed; no need to “create” `auto@` separately.

3. **Redirect URL**  
   - [ ] **Authentication** → **URL Configuration** (or Redirect URLs) includes the URL your app uses for the confirmation link, e.g. `https://yourdomain.com/auth/callback` and `http://localhost:3000/auth/callback`.

4. **Errors from Supabase**  
   - If Supabase shows an error when **saving** SMTP (e.g. “Authentication failed”), the API key or username is wrong or the key was revoked.
   - If Supabase saves but **no email arrives**, check Resend dashboard for the send (or bounce), and your spam folder. Check Auth → Logs for “Email sent” or errors.
