import { describe, it, expect } from 'vitest'
import {
  applyToggleRules, validateProfileDetails, parseProfileDetails, parseAddress, validateCoordinates,
  validateMobile, normalizeMobile, profileDetailsToForm, EMPTY_PROFILE_DETAILS, type ProfileDetailsForm,
} from '@/lib/profile-details'

// Pure rules for the personal-information form — no database needed.

const form = (over: Partial<ProfileDetailsForm> = {}): ProfileDetailsForm => ({ ...EMPTY_PROFILE_DETAILS, ...over })

const everythingOn = form({
  isPursuingEducation: true, currentCourse: 'B.Com', currentInstitution: 'Fergusson', expectedCompletionYear: String(new Date().getFullYear() + 1),
  isEarning: true, earningType: 'JOB', companyName: 'Acme', designation: 'Engineer', jobSector: 'PRIVATE',
  readyForMarriage: true, lookingForMarriage: true, marriageHeightCm: '170', motherTongue: 'Marathi',
  nativePlace: 'Satara', partnerExpectations: 'Kind',
})

describe('profile details — toggle rules', () => {
  it('keeps every dependent field while its parents are on', () => {
    expect(applyToggleRules(everythingOn, 'UNMARRIED', '')).toEqual(everythingOn)
  })

  it('clears the whole Unmarried flow for Married (and other statuses)', () => {
    for (const status of ['MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED', 'NOT_STATED']) {
      const out = applyToggleRules(everythingOn, status, '')
      expect(out.isEarning).toBe(false)
      expect(out.isPursuingEducation).toBe(false)
      expect(out.currentCourse).toBe('')
      expect(out.companyName).toBe('')
      expect(out.readyForMarriage).toBe(false)
      expect(out.motherTongue).toBe('')
    }
  })

  it('Pursuing education off clears course, institution and year only', () => {
    const out = applyToggleRules({ ...everythingOn, isPursuingEducation: false }, 'UNMARRIED', null)
    expect([out.currentCourse, out.currentInstitution, out.expectedCompletionYear]).toEqual([null, null, null])
    expect(out.companyName).toBe('Acme')
  })

  it('Earning off clears earning type, job, business and the marriage chain', () => {
    const out = applyToggleRules({ ...everythingOn, isEarning: false }, 'UNMARRIED', null)
    expect(out.earningType).toBeNull()
    expect(out.companyName).toBeNull()
    expect(out.readyForMarriage).toBe(false)
    expect(out.lookingForMarriage).toBe(false)
    expect(out.partnerExpectations).toBeNull()
    expect(out.currentCourse).toBe('B.Com') // unrelated toggle untouched
  })

  it('Ready for marriage off clears Looking for marriage and its details', () => {
    const out = applyToggleRules({ ...everythingOn, readyForMarriage: false }, 'UNMARRIED', null)
    expect(out.lookingForMarriage).toBe(false)
    expect([out.marriageHeightCm, out.motherTongue, out.nativePlace, out.partnerExpectations]).toEqual([null, null, null, null])
    expect(out.companyName).toBe('Acme')
  })

  it('Looking for marriage off clears only the marriage details', () => {
    const out = applyToggleRules({ ...everythingOn, lookingForMarriage: false }, 'UNMARRIED', null)
    expect(out.readyForMarriage).toBe(true)
    expect(out.motherTongue).toBeNull()
  })

  it('switching Job → Business drops the job fields', () => {
    const out = applyToggleRules({ ...everythingOn, earningType: 'BUSINESS', businessName: 'Shop' }, 'UNMARRIED', null)
    expect([out.companyName, out.designation, out.jobSector]).toEqual([null, null, null])
    expect(out.businessName).toBe('Shop')
  })

  it('"Other" education text only survives when Other is selected', () => {
    expect(applyToggleRules(form({ educationLevel: 'GRADUATE', educationOther: 'x' }), 'MARRIED', null).educationOther).toBeNull()
    expect(applyToggleRules(form({ educationLevel: 'OTHER', educationOther: 'x' }), 'MARRIED', null).educationOther).toBe('x')
  })
})

describe('profile details — validation', () => {
  const fields = (d: Partial<ProfileDetailsForm>, status = 'UNMARRIED') => validateProfileDetails(form(d), status).map((e) => e.field)

  it('an empty form is valid for every status (salary always optional)', () => {
    for (const s of ['UNMARRIED', 'MARRIED', 'WIDOWED']) expect(validateProfileDetails(form(), s)).toEqual([])
  })

  it('requires the fields a switched-on toggle asks for', () => {
    expect(fields({ isPursuingEducation: true })).toEqual(['currentCourse'])
    expect(fields({ isEarning: true })).toEqual(['earningType'])
    expect(fields({ isEarning: true, earningType: 'JOB' })).toEqual(['companyName'])
    expect(fields({ isEarning: true, earningType: 'BUSINESS' })).toEqual(['businessName'])
    expect(fields({ educationLevel: 'OTHER' })).toEqual(['educationOther'])
  })

  it('ignores required fields under toggles that are off, or for Married', () => {
    expect(fields({ isPursuingEducation: false, currentCourse: '' })).toEqual([])
    expect(fields({ isEarning: true, earningType: 'JOB' }, 'MARRIED')).toEqual([])
  })

  it('rejects values outside the fixed option lists and ranges', () => {
    expect(fields({ educationLevel: 'PHD' })).toEqual(['educationLevel'])
    expect(fields({ annualIncomeRange: '1CR' })).toEqual(['annualIncomeRange'])
    expect(fields({ isEarning: true, earningType: 'FARM' })).toEqual(['earningType'])
    expect(fields({ isEarning: true, earningType: 'JOB', companyName: 'A', jobSector: 'NGO' })).toEqual(['jobSector'])
    expect(fields({ isPursuingEducation: true, currentCourse: 'BA', expectedCompletionYear: '1990' })).toEqual(['expectedCompletionYear'])
    expect(fields({ ...everythingOn, marriageHeightCm: '20' })).toEqual(['marriageHeightCm'])
  })

  it('parseProfileDetails stores types correctly and drops fields under off toggles', () => {
    const parsed = parseProfileDetails({ ...everythingOn, isEarning: false, educationLevel: 'GRADUATE' }, 'UNMARRIED')
    expect(parsed.error).toBeUndefined()
    expect(parsed.data!.expectedCompletionYear).toBe(new Date().getFullYear() + 1)
    expect(parsed.data!.companyName).toBeNull()
    expect(parsed.data!.marriageHeightCm).toBeNull()
    expect(parsed.data!.educationLevel).toBe('GRADUATE')
    expect(parseProfileDetails('nope', 'UNMARRIED').error).toBeTruthy()
    expect(parseProfileDetails({ isPursuingEducation: true }, 'UNMARRIED').error).toMatch(/course/i)
  })

  it('a missing database row loads as an empty form', () => {
    expect(profileDetailsToForm(null)).toEqual(EMPTY_PROFILE_DETAILS)
  })
})

describe('mobile, PIN code and coordinates', () => {
  it('accepts 10-digit Indian mobiles, with or without +91 / 0 prefixes', () => {
    for (const ok of ['9876543210', '+91 98765 43210', '09876543210', '919876543210', '']) expect(validateMobile(ok)).toBeNull()
    for (const bad of ['12345', '5876543210', '98765432101', 'abcdefghij']) expect(validateMobile(bad)).toBeTruthy()
    expect(normalizeMobile('+91 98765-43210')).toBe('9876543210')
  })

  it('validates the PIN code for Indian addresses only', () => {
    expect(parseAddress({ pincode: '411038' }).error).toBeUndefined()
    expect(parseAddress({ pincode: '011038' }).error).toMatch(/PIN/)
    expect(parseAddress({ pincode: '41103' }).error).toMatch(/PIN/)
    expect(parseAddress({ pincode: 'SW1A 1AA', country: 'UK' }).error).toBeUndefined()
  })

  it('requires both coordinates, within range', () => {
    expect(validateCoordinates(null, null)).toBeNull()
    expect(validateCoordinates(18.52, 73.85)).toBeNull()
    expect(validateCoordinates(18.52, null)?.message).toMatch(/together/)
    expect(validateCoordinates(91, 73)?.field).toBe('latitude')
    expect(validateCoordinates(-91, 73)?.field).toBe('latitude')
    expect(validateCoordinates(18, 181)?.field).toBe('longitude')
    expect(validateCoordinates('abc', 73)?.field).toBe('latitude')
  })
})
