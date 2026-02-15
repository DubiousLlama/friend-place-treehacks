# Free SMTP setup guide (for Supabase auth emails)

This guide walks you through setting up a **free SMTP provider** so Supabase can send confirmation (and other auth) emails to real inboxes. Two options: **Resend** (simplest) and **Brevo** (more emails/day on free tier).

---

## Option A: Resend (recommended to start)

**Free tier:** 3,000 emails/month (100/day). One custom domain. No credit card required.

### 1. Create a Resend account

1. Go to [resend.com](https://resend.com) and sign up (email or Google).
2. Verify your email if prompted.

### 2. Add and verify a domain (or use their test domain)

- **For testing:** Resend may let you send from `onboarding@resend.dev` to your own email only at first. Check the dashboard after signup.
- **For real use:** Add your own domain (e.g. `yourdomain.com`) under **Domains** → **Add domain**. They’ll give you DNS records (e.g. SPF, DKIM); add those in your domain/DNS provider. Once verified, you can use addresses like `noreply@yourdomain.com`.

If you don’t have a domain yet, use the test sender if available, or skip to **Brevo** below (Brevo’s free tier often allows sending without your own domain for low volume).

### 3. Create an API key

1. In Resend: **API Keys** (in the sidebar or account menu).
2. Click **Create API Key**.
3. Name it (e.g. `Supabase Auth`), leave permissions as default if applicable.
4. Copy the key (starts with `re_...`). You won’t see it again.

### 4. Get your SMTP details

Resend’s SMTP settings:

| Field    | Value              |
|----------|--------------------|
| **Host** | `smtp.resend.com`  |
| **Port** | `465` (SSL)        |
| **User** | `resend`           |
| **Password** | Your API key (the `re_...` key) |

Sender address: use the address Resend shows as verified (e.g. `onboarding@resend.dev` for testing, or `noreply@yourdomain.com` after domain verification).

### 5. Plug into Supabase

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **SMTP** (or **Auth** → **Settings**).
2. Enable **Custom SMTP**.
3. Fill in:
   - **Sender email:** e.g. `onboarding@resend.dev` (test) or `noreply@yourdomain.com`.
   - **Sender name:** e.g. `Friend Place`.
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** your Resend API key
4. Save.

Try signing up again; the confirmation email should be sent via Resend. Check spam once.

Docs: [Resend – Send with SMTP](https://resend.com/docs/send-with-smtp).

---

## Option B: Brevo (formerly Sendinblue)

**Free tier:** 300 emails per day (about 9,000/month). No credit card. Good inbox delivery.

### 1. Create a Brevo account

1. Go to [brevo.com](https://www.brevo.com) and sign up.
2. Confirm your email and complete the short onboarding.

### 2. Get your SMTP credentials

1. In Brevo: **Settings** (gear icon) → **SMTP & API** (or **Senders, domains & deduplication**).
2. Under **SMTP**, note:
   - **Server:** `smtp-relay.brevo.com`
   - **Port:** `587` (TLS) or `465` (SSL).
3. You need an **SMTP key** (not the main API key):
   - In **SMTP & API**, find **SMTP key** or **Generate SMTP key**.
   - Create a key and copy it.
4. **Login:** Usually your Brevo account email, or the “SMTP login” they show on that page.

### 3. Sender address and domain

- Brevo may require you to add a **sender** (email + name) and verify the domain.
- Go to **Senders & IP** (or **Domains**) and add your sender email (e.g. `noreply@yourdomain.com`). If you don’t have a domain, they sometimes allow sending from a verified address; check the dashboard.
- Add the DNS records they give you (SPF/DKIM) at your DNS provider so the domain is verified.

### 4. Brevo SMTP summary

| Field       | Value                    |
|------------|--------------------------|
| **Host**   | `smtp-relay.brevo.com`   |
| **Port**   | `587` (TLS) or `465` (SSL) |
| **Username** | Your Brevo SMTP login (often your account email) |
| **Password** | Your Brevo **SMTP key**  |

### 5. Plug into Supabase

1. Supabase → **Authentication** → **SMTP** → enable **Custom SMTP**.
2. Use:
   - **Sender email:** the verified sender in Brevo (e.g. `noreply@yourdomain.com`).
   - **Sender name:** e.g. `Friend Place`.
   - **Host:** `smtp-relay.brevo.com`
   - **Port:** `587` or `465`
   - **Username:** Brevo SMTP login
   - **Password:** Brevo SMTP key
3. Save.

Try a new sign-up and check inbox/spam.

Docs: [Brevo – Send transactional emails using SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450).

---

## After SMTP is set

- **Redirect URLs:** In Supabase → **Authentication** → **URL Configuration**, add `http://localhost:3000/auth/callback` and your production URL so the link in the email works. See [Supabase email setup](supabase-email-setup.md).
- **Spam:** First emails may land in spam; mark as “Not spam” to improve delivery.
- **Limits:** Stay within the provider’s free limits (Resend 100/day, Brevo 300/day) to avoid blocks.

---

## Quick comparison

|           | Resend        | Brevo           |
|-----------|---------------|-----------------|
| Free tier | 100/day       | 300/day         |
| Setup     | API key → SMTP| SMTP login + key |
| Domain    | Optional for test | Sender/domain often required |

Use **Resend** if you want the fastest path (API key = SMTP password). Use **Brevo** if you want more free emails per day and don’t mind a bit more setup (SMTP key + sender/domain).
