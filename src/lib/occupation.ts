/**
 * F02 social status and occupation (client + server). Social status lives in
 * the existing members.employmentStatus column; the occupation details in
 * member_profile_details. Older values written by the previous form
 * (EMPLOYED, SELF_EMPLOYED, BUSINESS, PROFESSIONAL, NOT_EARNING) are still
 * accepted and mapped when read, so no stored row needs rewriting.
 */
export const SOCIAL_STATUSES = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'WORKING', label: 'Working' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'HOMEMAKER', label: 'Homemaker' },
  { value: 'NOT_WORKING', label: 'Not working' },
] as const

export const LEGACY_SOCIAL_STATUS: Record<string, { status: string; source?: string }> = {
  EMPLOYED: { status: 'WORKING', source: 'SERVICE' },
  SELF_EMPLOYED: { status: 'WORKING', source: 'BUSINESS' },
  BUSINESS: { status: 'WORKING', source: 'BUSINESS' },
  PROFESSIONAL: { status: 'WORKING', source: 'PROFESSIONAL' },
  NOT_EARNING: { status: 'NOT_WORKING' },
}

export const INCOME_SOURCES = [
  { value: 'SERVICE', label: 'Service (job)' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'PROFESSIONAL', label: 'Professional' },
] as const

export const SERVICE_TYPES = [
  { value: 'GOVT', label: 'Government' },
  { value: 'PRIVATE', label: 'Private' },
  { value: 'PSU', label: 'PSU' },
  { value: 'OTHER', label: 'Other' },
] as const

export const PROFESSIONS = [
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'CA', label: 'Chartered Accountant' },
  { value: 'LAWYER', label: 'Lawyer' },
  { value: 'ENGINEER', label: 'Engineer' },
  { value: 'OTHER', label: 'Other' },
] as const

export const OCCUPATION_FIELDS = [
  'incomeSource', 'serviceType', 'employerName', 'occBusinessType', 'occBusinessName', 'profession', 'professionOther',
] as const
export type OccupationData = Record<(typeof OCCUPATION_FIELDS)[number], string | null>

const isIn = (opts: readonly { value: string }[], v: unknown) => opts.some((o) => o.value === v)
const t = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().slice(0, 191))

/** Canonical social status for a stored value (old or new vocabulary). */
export function canonicalSocialStatus(v: string | null | undefined): string | null {
  if (!v) return null
  if (isIn(SOCIAL_STATUSES, v)) return v
  return LEGACY_SOCIAL_STATUS[v]?.status ?? null
}

/** F02 rule: earning = Working with an income band chosen ("Prefer not to say" is not a band). */
export function isEarning(socialStatus: string | null | undefined, annualIncomeRange: string | null | undefined) {
  return canonicalSocialStatus(socialStatus) === 'WORKING' && !!annualIncomeRange && annualIncomeRange !== 'NOT_SAY'
}

/**
 * Validates the occupation block for a social status. Anything that doesn't
 * apply to the chosen status / source is stored empty. Income band is
 * required while Working (it is stored as a band, never an amount).
 */
export function parseOccupation(socialStatus: unknown, input: unknown, annualIncomeRange: unknown):
  { data: OccupationData; error?: undefined } | { error: string; data?: undefined } {
  const empty = Object.fromEntries(OCCUPATION_FIELDS.map((f) => [f, null])) as OccupationData
  if (!isIn(SOCIAL_STATUSES, socialStatus)) return { error: 'Choose a social status: Student, Working, Retired, Homemaker or Not working' }
  if (socialStatus !== 'WORKING') return { data: empty }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const d: OccupationData = { ...empty, incomeSource: t(raw.incomeSource) }
  if (!isIn(INCOME_SOURCES, d.incomeSource)) return { error: 'Choose the source of income: Service, Business or Professional' }
  if (!annualIncomeRange) return { error: 'Choose your approximate annual income band' }

  if (d.incomeSource === 'SERVICE') {
    d.serviceType = t(raw.serviceType)
    d.employerName = t(raw.employerName)
    if (!isIn(SERVICE_TYPES, d.serviceType)) return { error: 'Choose the type of service: Government, Private, PSU or Other' }
    if (!d.employerName) return { error: 'Employer name is required' }
  } else if (d.incomeSource === 'BUSINESS') {
    d.occBusinessType = t(raw.occBusinessType)
    d.occBusinessName = t(raw.occBusinessName)
    if (!d.occBusinessType) return { error: 'Type of business is required' }
    if (!d.occBusinessName) return { error: 'Business name is required' }
  } else {
    d.profession = t(raw.profession)
    if (!isIn(PROFESSIONS, d.profession)) return { error: 'Choose a profession from the list' }
    if (d.profession === 'OTHER') {
      d.professionOther = t(raw.professionOther)
      if (!d.professionOther) return { error: 'Describe the profession' }
    }
  }
  return { data: d }
}
