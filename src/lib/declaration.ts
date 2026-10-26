/**
 * F03 self-declaration. The version is stored on every consent record next
 * to a copy of the exact text, so a later wording change never alters what
 * a member agreed to. Change the text → bump the version.
 */
export const DECLARATION_VERSION = 'LADWANI-DECL-2026-10-v1'

export const DECLARATION_TEXT = [
  'I declare that the information I have given in my LadWani profile and the identity documents I have uploaded are true, complete and my own.',
  'I understand that I alone am responsible for any discrepancy in this information, and for any legal action that may arise from it.',
  'I agree that LadWani operators may use these documents only to verify my registration, and that a copy of this declaration is kept with the date, time, my IP address and the one-time code I confirm it with.',
].join('\n\n')
