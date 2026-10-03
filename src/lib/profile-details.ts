import { PINCODE_REGEX } from '@/lib/validators'

/**
 * Personal-information extras on the Edit Profile form: fixed option lists,
 * the toggle → dependent-field rules, and validation. Shared by the form
 * (client) and PATCH /api/members/[id] (server) so the two can't drift.
 *
 * Toggle rule: a field under a toggle is only ever kept while that toggle is
 * on. Switching a toggle off — or the member no longer being Unmarried —
 * clears everything beneath it, on the client as you click and again on the
 * server before anything is stored.
 */

export const EDUCATION_LEVELS = [
  { value: 'NONE', label: 'No formal education' },
  { value: 'PRIMARY', label: 'Primary' },
  { value: 'SECONDARY', label: 'Secondary (10th)' },
  { value: 'HIGHER_SECONDARY', label: 'Higher Secondary (12th)' },
  { value: 'ITI', label: 'ITI' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'GRADUATE', label: 'Graduate' },
  { value: 'POST_GRADUATE', label: 'Post Graduate' },
  { value: 'DOCTORATE', label: 'Doctorate' },
  { value: 'PROFESSIONAL', label: 'Professional (CA/CS/MBBS/LLB etc.)' },
  { value: 'OTHER', label: 'Other' },
] as const

export const INCOME_RANGES = [
  { value: 'BELOW_2L', label: 'Below 2 LPA' },
  { value: '2L_5L', label: '2–5 LPA' },
  { value: '5L_10L', label: '5–10 LPA' },
  { value: '10L_20L', label: '10–20 LPA' },
  { value: '20L_50L', label: '20–50 LPA' },
  { value: 'ABOVE_50L', label: 'Above 50 LPA' },
  { value: 'NOT_SAY', label: 'Prefer not to say' },
] as const

export const EARNING_TYPES = [
  { value: 'JOB', label: 'Job' },
  { value: 'BUSINESS', label: 'Business' },
] as const

export const JOB_SECTORS = [
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'PRIVATE', label: 'Private' },
  { value: 'OTHER', label: 'Other' },
] as const

export const TOGGLE_FIELDS = ['isEarning', 'isPursuingEducation', 'readyForMarriage', 'lookingForMarriage'] as const
export type ToggleField = (typeof TOGGLE_FIELDS)[number]

const STUDY_FIELDS = ['currentCourse', 'currentInstitution', 'expectedCompletionYear'] as const
const JOB_FIELDS = ['companyName', 'designation', 'jobSector'] as const
const BUSINESS_FIELDS = ['businessName', 'businessType'] as const
const MARRIAGE_FIELDS = ['marriageHeightCm', 'motherTongue', 'nativePlace', 'partnerExpectations'] as const

/** Everything a toggle owns. Switching the toggle off clears all of these. */
export const TOGGLE_DEPENDENTS: Record<ToggleField, readonly string[]> = {
  isPursuingEducation: STUDY_FIELDS,
  isEarning: ['earningType', ...JOB_FIELDS, ...BUSINESS_FIELDS, 'readyForMarriage', 'lookingForMarriage', ...MARRIAGE_FIELDS],
  readyForMarriage: ['lookingForMarriage', ...MARRIAGE_FIELDS],
  lookingForMarriage: MARRIAGE_FIELDS,
}

/** Fields that belong to one earning type; picking the other type clears them. */
export const EARNING_TYPE_FIELDS: Record<string, readonly string[]> = {
  JOB: JOB_FIELDS,
  BUSINESS: BUSINESS_FIELDS,
}

/** The whole Unmarried-only flow; cleared when marital status is anything else. */
export const UNMARRIED_FLOW_FIELDS = ['isEarning', 'isPursuingEducation', ...TOGGLE_DEPENDENTS.isPursuingEducation, ...TOGGLE_DEPENDENTS.isEarning] as const

export const BOOLEAN_FIELDS: readonly string[] = TOGGLE_FIELDS
const INT_FIELDS = ['expectedCompletionYear', 'marriageHeightCm']

/** Database values for "the Unmarried flow is empty". */
export const UNMARRIED_FLOW_RESET = Object.fromEntries(
  UNMARRIED_FLOW_FIELDS.map((f) => [f, BOOLEAN_FIELDS.includes(f) ? false : null])
) as Record<(typeof UNMARRIED_FLOW_FIELDS)[number], null | false>

export const PROFILE_DETAIL_TEXT_FIELDS = [
  'educationLevel', 'educationOther', 'educationStream', 'educationInstitution', 'annualIncomeRange',
  'currentCourse', 'currentInstitution', 'earningType', 'companyName', 'designation', 'jobSector',
  'businessName', 'businessType', 'motherTongue', 'nativePlace', 'partnerExpectations',
] as const

/** Shape the form edits: text inputs are strings, toggles are booleans. */
export interface ProfileDetailsForm {
  educationLevel: string
  educationOther: string
  educationStream: string
  educationInstitution: string
  annualIncomeRange: string
  isEarning: boolean
  isPursuingEducation: boolean
  currentCourse: string
  currentInstitution: string
  expectedCompletionYear: string
  earningType: string
  companyName: string
  designation: string
  jobSector: string
  businessName: string
  businessType: string
  readyForMarriage: boolean
  lookingForMarriage: boolean
  marriageHeightCm: string
  motherTongue: string
  nativePlace: string
  partnerExpectations: string
}

export const EMPTY_PROFILE_DETAILS: ProfileDetailsForm = {
  educationLevel: '', educationOther: '', educationStream: '', educationInstitution: '', annualIncomeRange: '',
  isEarning: false, isPursuingEducation: false,
  currentCourse: '', currentInstitution: '', expectedCompletionYear: '',
  earningType: '', companyName: '', designation: '', jobSector: '', businessName: '', businessType: '',
  readyForMarriage: false, lookingForMarriage: false,
  marriageHeightCm: '', motherTongue: '', nativePlace: '', partnerExpectations: '',
}

/** Shape stored in member_profile_details (minus ids/timestamps). */
export type ProfileDetailsData = {
  [K in keyof ProfileDetailsForm]: ProfileDetailsForm[K] extends boolean ? boolean : K extends 'expectedCompletionYear' | 'marriageHeightCm' ? number | null : string | null
}

/** A stored row (or null for members who never saved one) → form values. */
export function profileDetailsToForm(row: Partial<Record<string, unknown>> | null | undefined): ProfileDetailsForm {
  const out: Record<string, unknown> = { ...EMPTY_PROFILE_DETAILS }
  if (!row) return out as unknown as ProfileDetailsForm
  for (const key of Object.keys(EMPTY_PROFILE_DETAILS)) {
    const v = row[key]
    if (BOOLEAN_FIELDS.includes(key)) out[key] = v === true
    else out[key] = v === null || v === undefined ? '' : String(v)
  }
  return out as unknown as ProfileDetailsForm
}

const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

/**
 * Returns a copy with every field whose parent toggle is off (or whose
 * earning type isn't selected) set to its empty value. `empty` decides what
 * "empty" is: '' for the form, null for the database.
 */
export function applyToggleRules<T extends Record<string, unknown>>(
  input: T,
  maritalStatus: string | null | undefined,
  empty: '' | null = null
): T {
  const d: Record<string, unknown> = { ...input }
  const clear = (fields: readonly string[]) => {
    for (const f of fields) d[f] = BOOLEAN_FIELDS.includes(f) ? false : empty
  }
  if (maritalStatus !== 'UNMARRIED') {
    clear(UNMARRIED_FLOW_FIELDS)
  } else {
    // Parents first, so a cleared parent also clears its grandchildren.
    for (const t of TOGGLE_FIELDS) if (d[t] !== true) clear(TOGGLE_DEPENDENTS[t])
    for (const [type, fields] of Object.entries(EARNING_TYPE_FIELDS)) if (d.earningType !== type) clear(fields)
  }
  if (d.educationLevel !== 'OTHER') d.educationOther = empty
  return d as T
}

export interface FieldError {
  field: string
  message: string
}

const isOption = (options: readonly { value: string }[], v: unknown) => options.some((o) => o.value === v)

/**
 * Validates profile details as they would be stored — i.e. after the toggle
 * rules have run, so a hidden section can never block a save. Returns every
 * problem found (empty list = valid).
 */
export function validateProfileDetails(input: Record<string, unknown>, maritalStatus: string | null | undefined): FieldError[] {
  const d = applyToggleRules(input, maritalStatus, '')
  const errors: FieldError[] = []
  const add = (field: string, message: string) => errors.push({ field, message })

  for (const f of PROFILE_DETAIL_TEXT_FIELDS) {
    const v = d[f]
    if (v !== undefined && v !== null && typeof v !== 'string') add(f, 'Must be text')
    else if (typeof v === 'string' && v.length > (f === 'partnerExpectations' ? 1000 : 191)) {
      add(f, f === 'partnerExpectations' ? 'Keep this under 1000 characters' : 'Too long')
    }
  }
  for (const f of TOGGLE_FIELDS) {
    if (d[f] !== undefined && typeof d[f] !== 'boolean') add(f, 'Must be on or off')
  }

  if (!blank(d.educationLevel) && !isOption(EDUCATION_LEVELS, d.educationLevel)) add('educationLevel', 'Choose an education level from the list')
  if (d.educationLevel === 'OTHER' && blank(d.educationOther)) add('educationOther', 'Please describe the education')
  if (!blank(d.annualIncomeRange) && !isOption(INCOME_RANGES, d.annualIncomeRange)) add('annualIncomeRange', 'Choose an income range from the list')

  if (d.isPursuingEducation === true) {
    if (blank(d.currentCourse)) add('currentCourse', 'Current course is required')
    if (!blank(d.expectedCompletionYear)) {
      const y = Number(d.expectedCompletionYear)
      const now = new Date().getFullYear()
      if (!Number.isInteger(y) || y < now - 1 || y > now + 15) add('expectedCompletionYear', `Enter a year between ${now - 1} and ${now + 15}`)
    }
  }

  if (d.isEarning === true) {
    if (blank(d.earningType)) add('earningType', 'Choose Job or Business')
    else if (!isOption(EARNING_TYPES, d.earningType)) add('earningType', 'Choose Job or Business')
    if (d.earningType === 'JOB') {
      if (blank(d.companyName)) add('companyName', 'Company name is required')
      if (!blank(d.jobSector) && !isOption(JOB_SECTORS, d.jobSector)) add('jobSector', 'Choose a sector from the list')
    }
    if (d.earningType === 'BUSINESS' && blank(d.businessName)) add('businessName', 'Business name is required')
  }

  if (d.lookingForMarriage === true && !blank(d.marriageHeightCm)) {
    const h = Number(d.marriageHeightCm)
    if (!Number.isInteger(h) || h < 100 || h > 250) add('marriageHeightCm', 'Height must be a whole number between 100 and 250 cm')
  }
  return errors
}

/**
 * Server side: validate and normalise a submitted details object into the
 * exact row to store. Dependent fields of an off toggle are dropped (stored
 * as empty) no matter what the client sent.
 */
export function parseProfileDetails(
  input: unknown,
  maritalStatus: string | null | undefined
): { data: ProfileDetailsData; error?: undefined } | { error: string; data?: undefined } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Invalid profile details' }
  const raw = input as Record<string, unknown>
  const errors = validateProfileDetails(raw, maritalStatus)
  if (errors.length) return { error: errors[0].message }

  const d = applyToggleRules(raw, maritalStatus, null)
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(EMPTY_PROFILE_DETAILS)) {
    const v = d[key]
    if (BOOLEAN_FIELDS.includes(key)) out[key] = v === true
    else if (INT_FIELDS.includes(key)) out[key] = blank(v) ? null : Number(v)
    else out[key] = blank(v) ? null : String(v).trim()
  }
  return { data: out as ProfileDetailsData }
}

// ─── Mobile ───────────────────────────────────────────────────────

export const MOBILE_REGEX = /^[6-9]\d{9}$/

/** Strips spaces/dashes and a +91, 91 or 0 prefix: "+91 98765-43210" → "9876543210". */
export function normalizeMobile(v: string): string {
  const s = v.replace(/[\s-]/g, '')
  if (/^\+91\d{10}$/.test(s)) return s.slice(3)
  if (/^91\d{10}$/.test(s)) return s.slice(2)
  if (/^0\d{10}$/.test(s)) return s.slice(1)
  return s
}

/** Blank is fine; anything else must be a 10-digit Indian mobile number. */
export function validateMobile(v: unknown): string | null {
  if (blank(v)) return null
  return MOBILE_REGEX.test(normalizeMobile(String(v))) ? null : 'Enter a valid 10-digit Indian mobile number'
}

// ─── Address & geo-tag ────────────────────────────────────────────

export interface AddressForm {
  line1: string     // house / street
  line2: string     // area / locality
  city: string      // city / village
  taluka: string
  district: string
  state: string
  pincode: string
  country: string
  latitude: number | null
  longitude: number | null
}

export const EMPTY_ADDRESS: AddressForm = {
  line1: '', line2: '', city: '', taluka: '', district: '', state: '', pincode: '', country: 'India',
  latitude: null, longitude: null,
}

export function addressToForm(row: Partial<Record<string, unknown>> | null | undefined): AddressForm {
  if (!row) return { ...EMPTY_ADDRESS }
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
  const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
  return {
    line1: s(row.line1), line2: s(row.line2), city: s(row.city), taluka: s(row.taluka),
    district: s(row.district), state: s(row.state), pincode: s(row.pincode),
    country: s(row.country) || 'India', latitude: n(row.latitude), longitude: n(row.longitude),
  }
}

/** Both coordinates or neither, each a finite number within WGS84 range. */
export function validateCoordinates(lat: unknown, lng: unknown): FieldError | null {
  if (blank(lat) && blank(lng)) return null
  if (blank(lat) || blank(lng)) return { field: 'latitude', message: 'Latitude and longitude must be set together' }
  const la = Number(lat)
  const lo = Number(lng)
  if (!Number.isFinite(la) || la < -90 || la > 90) return { field: 'latitude', message: 'Latitude must be between -90 and 90' }
  if (!Number.isFinite(lo) || lo < -180 || lo > 180) return { field: 'longitude', message: 'Longitude must be between -180 and 180' }
  return null
}

export function validateAddress(input: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = []
  for (const f of ['line1', 'line2', 'city', 'taluka', 'district', 'state', 'pincode', 'country']) {
    const v = input[f]
    if (v !== undefined && v !== null && typeof v !== 'string') errors.push({ field: f, message: 'Must be text' })
    else if (typeof v === 'string' && v.length > 191) errors.push({ field: f, message: 'Too long' })
  }
  const country = blank(input.country) ? 'india' : String(input.country).trim().toLowerCase()
  if (!blank(input.pincode) && country === 'india' && !PINCODE_REGEX.test(String(input.pincode).trim())) {
    errors.push({ field: 'pincode', message: 'Enter a valid 6-digit PIN code' })
  }
  const geo = validateCoordinates(input.latitude, input.longitude)
  if (geo) errors.push(geo)
  return errors
}

export interface AddressData {
  line1: string | null
  line2: string | null
  city: string | null
  taluka: string | null
  district: string | null
  state: string | null
  pincode: string | null
  country: string
  latitude: number | null
  longitude: number | null
}

export function parseAddress(input: unknown): { data: AddressData; error?: undefined } | { error: string; data?: undefined } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Invalid address' }
  const raw = input as Record<string, unknown>
  const errors = validateAddress(raw)
  if (errors.length) return { error: errors[0].message }
  const t = (v: unknown) => (blank(v) ? null : String(v).trim())
  return {
    data: {
      line1: t(raw.line1), line2: t(raw.line2), city: t(raw.city), taluka: t(raw.taluka),
      district: t(raw.district), state: t(raw.state), pincode: t(raw.pincode),
      country: t(raw.country) ?? 'India',
      latitude: blank(raw.latitude) ? null : Number(raw.latitude),
      longitude: blank(raw.longitude) ? null : Number(raw.longitude),
    },
  }
}

/** True when nothing at all has been entered (don't create an empty row). */
export function isAddressEmpty(a: AddressData): boolean {
  return [a.line1, a.line2, a.city, a.taluka, a.district, a.state, a.pincode, a.latitude, a.longitude].every((v) => v === null)
}
