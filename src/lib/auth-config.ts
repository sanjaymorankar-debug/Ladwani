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
