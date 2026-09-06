# Configuring email (Hostinger)

The platform needs outbound email for two things: **password reset** (which
cannot work without it) and **email verification at sign-up** (currently
switched off — turn it on once email is proven working).

## 1. Create the mailbox in hPanel

In Hostinger's hPanel: **Emails → Email Accounts → Create email account**.

Make a dedicated sending address rather than reusing a personal one, e.g.
`noreply@agtci.com`. Set a password and keep it — this password *is* the SMTP
password. It is **not** your Hostinger account password.

> The domain must actually be hosted for email on Hostinger (its MX records
> pointing at Hostinger). If your domain's email is elsewhere, use that
> provider's SMTP settings instead.

## 2. Find your exact SMTP settings

hPanel shows them under **Emails → your mailbox → Configuration settings →
Manual configuration**. Use whatever that page shows — it is authoritative for
your account. For most Hostinger plans it will be:

| Setting | Value |
|---|---|
| SMTP host | `smtp.hostinger.com` |
| Port | `465` (SSL/TLS) — or `587` (STARTTLS) |
| Username | the **full email address**, e.g. `noreply@agtci.com` |
| Password | the mailbox password you just set |
| Encryption | SSL/TLS on 465, STARTTLS on 587 |

**One important variant:** some Hostinger plans provide mail through **Titan**
rather than Hostinger's own mail servers. If hPanel shows Titan branding, the
host is `smtp.titan.email` (ports 465/587) instead. Check before assuming.

## 3. Put the settings in `.env`

```bash
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT=465
SMTP_USER="noreply@agtci.com"
SMTP_PASSWORD="the-mailbox-password"
SMTP_FROM="noreply@agtci.com"
```

Two things that cause most failures:

- **`SMTP_FROM` must match `SMTP_USER`.** Hostinger rejects sending as an
  address you haven't authenticated as. (If you omit `SMTP_FROM`, the app now
  falls back to `SMTP_USER` automatically.)
- **Port and encryption must agree.** 465 is implicit TLS, 587 is STARTTLS. The
  app derives this from the port, so you normally don't set anything else. To
  override: `SMTP_SECURE=true|false`.

## 4. Test it before relying on it

```bash
npm run test:smtp -- your.personal@gmail.com
```

This verifies the connection and credentials first, then sends one real message.
On failure it prints the specific cause (bad credentials, wrong port, unresolved
host, rejected From address) rather than a raw stack trace.

Check the spam folder too — a brand-new sending address usually lands there
until SPF/DKIM are in place (step 6).

## 5. Turn on email verification

Once step 4 sends successfully:

```bash
NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION=true
```

Restart the app. Registration now emails a 6-digit code, new accounts start
`PENDING`, and login refuses them until the code is entered. Password reset
starts working at the same time.

Leave it `false` while testing — accounts stay usable immediately with no code.

## 6. Deliverability (do this before real members sign up)

Without these, mail from a new address often goes to spam or is dropped:

- **SPF** — hPanel usually adds this automatically when you create a mailbox.
  Verify a TXT record exists on the domain including Hostinger's servers.
- **DKIM** — enable under **Emails → Email Accounts → DKIM** (or Titan's
  equivalent) and add the record it gives you.
- **DMARC** — optional but recommended; start with
  `v=DMARC1; p=none; rua=mailto:you@agtci.com` to monitor before enforcing.

Send yourself a test to a Gmail address and check **Show original** to confirm
SPF and DKIM both show `PASS`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Invalid login` / `535` | `SMTP_USER` isn't the full email address, or you used your hPanel account password instead of the mailbox password |
| Connection times out | Port/encryption mismatch — try 587 if 465 hangs, or vice versa. Some office/ISP networks block outbound 465 |
| `ENOTFOUND` | Host typo, or you're on Titan and need `smtp.titan.email` |
| Sends, but lands in spam | SPF/DKIM not set up yet (step 6) |
| `550` / sender rejected | `SMTP_FROM` doesn't match the authenticated mailbox |

Nothing here is committed: `.env` is gitignored. On the server, set the same
variables in your deployment's environment.
