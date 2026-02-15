# Supabase email setup (confirmation emails)

If confirmation emails from sign-up aren’t arriving (inbox or junk), it’s usually due to Supabase’s **default email limits** or missing **custom SMTP** configuration.

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
