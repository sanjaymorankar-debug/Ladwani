#!/usr/bin/env node
/**
 * Proves your SMTP settings work, before you turn email verification on.
 *
 *   node scripts/with-env.js .env node scripts/test-smtp.js you@example.com
 *
 * Step 1 checks the connection and credentials (no mail sent).
 * Step 2 sends one real test message to the address you pass.
 */
const nodemailer = require('nodemailer')

const to = process.argv[2]
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_SECURE } = process.env

const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'].filter((k) => !process.env[k])
if (missing.length) {
  console.error(`✗ Missing in your env file: ${missing.join(', ')}`)
  process.exit(1)
}

const port = parseInt(SMTP_PORT || '587', 10)
const secure = SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465

console.log('SMTP settings in use:')
console.log(`  host   : ${SMTP_HOST}`)
console.log(`  port   : ${port}`)
console.log(`  secure : ${secure}   ${secure ? '(implicit TLS)' : '(STARTTLS)'}`)
console.log(`  user   : ${SMTP_USER}`)
console.log(`  from   : ${SMTP_FROM || SMTP_USER}`)
console.log(`  pass   : ${'*'.repeat(Math.min((SMTP_PASSWORD || '').length, 12))}\n`)

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure,
  auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
})

function explain(err) {
  const msg = String(err && err.message ? err.message : err)
  if (/Invalid login|535|authentication failed/i.test(msg)) {
    return 'Credentials rejected. SMTP_USER must be the FULL email address, and SMTP_PASSWORD its mailbox password (the one you set in hPanel, not your Hostinger account password).'
  }
  if (/ETIMEDOUT|ESOCKET|ECONNREFUSED|timeout/i.test(msg)) {
    return `Could not reach ${SMTP_HOST}:${port}. Usually this is the port/secure mismatch — use 465 with secure=true, or 587 with secure=false. Some ISPs and hosts also block outbound port 25/465; try the other port.`
  }
  if (/ENOTFOUND|getaddrinfo/i.test(msg)) {
    return `Host "${SMTP_HOST}" did not resolve. Check for a typo (Hostinger is normally smtp.hostinger.com; Titan-based mailboxes use smtp.titan.email).`
  }
  if (/self.signed|certificate/i.test(msg)) {
    return 'TLS certificate problem — confirm the hostname matches your provider exactly.'
  }
  if (/from|sender|not allowed|550/i.test(msg)) {
    return 'The From address was rejected. Set SMTP_FROM to the same mailbox as SMTP_USER — most providers refuse to send as an address you have not authenticated as.'
  }
  return null
}

;(async () => {
  try {
    process.stdout.write('1/2 Verifying connection and credentials... ')
    await transporter.verify()
    console.log('✓ OK')
  } catch (e) {
    console.log('✗ FAILED')
    console.error(`\n  ${e.message}`)
    const hint = explain(e)
    if (hint) console.error(`\n  → ${hint}`)
    process.exit(1)
  }

  if (!to) {
    console.log('\nConnection works. Pass an address to also send a test email:')
    console.log('  node scripts/with-env.js .env node scripts/test-smtp.js you@example.com')
    process.exit(0)
  }

  try {
    process.stdout.write(`2/2 Sending test email to ${to}... `)
    const info = await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: 'Mi Ladwani — SMTP test',
      text: 'If you are reading this, Mi Ladwani can send email. You can now set NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION=true.',
      html: '<p>If you are reading this, <strong>Mi Ladwani can send email</strong>.</p><p>You can now set <code>NEXT_PUBLIC_AUTH_REQUIRE_VERIFICATION=true</code>.</p>',
    })
    console.log('✓ SENT')
    console.log(`\n  messageId: ${info.messageId}`)
    console.log(`  accepted : ${info.accepted.join(', ')}`)
    if (info.rejected && info.rejected.length) console.log(`  rejected : ${info.rejected.join(', ')}`)
    console.log('\nCheck the inbox (and the spam folder — a new sending domain often lands there until SPF/DKIM are set).')
  } catch (e) {
    console.log('✗ FAILED')
    console.error(`\n  ${e.message}`)
    const hint = explain(e)
    if (hint) console.error(`\n  → ${hint}`)
    process.exit(1)
  }
})()
