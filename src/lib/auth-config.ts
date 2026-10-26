/**
 * Account verification switch.
 *
 * Right now the platform runs on plain email-or-mobile + password with no OTP:
 * a new account is usable the moment it's created. This keeps testing
 * frictionless while there is no SMS gateway and no SMTP server configured.
 *
 * When you're ready to move to verified email sign-up, set
 * `NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION=true` and the existing flow comes
 * back with no code change: registration issues an OTP again, new accounts
 * start PENDING, and login refuses them until verified.
 *
 * Deliberately one NEXT_PUBLIC_ variable read by both server and client, so
 * the API and the registration UI can never disagree about whether there's a
 * verification step. It's a feature flag, not a secret. The server is still
 * the enforcement point — the client only uses it to decide which screens to
 * show.
 */
export const requireAccountVerification =
  process.env.NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION === 'true'

/**
 * F32: Admin accounts need a second factor — a 6-digit code emailed after the
 * password is accepted (src/lib/otp.ts). On by default; set
 * AUTH_ADMIN_2FA=false only for a local environment with no mail at all.
 * Server-only, so it is not a NEXT_PUBLIC_ flag: the login form learns that a
 * code is needed from /api/auth/login-check.
 */
export function adminSecondFactorRequired(): boolean {
  return process.env.AUTH_ADMIN_2FA !== 'false'
}
