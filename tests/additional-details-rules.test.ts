import { describe, it, expect } from 'vitest'
import { parseSectionInput, coerceField, maskValue, SectionInputError } from '@/lib/additional-details/parse'
import {
  SECTIONS, SECTION_BY_KEY, applicableSections, completenessScore, maxVisibilityFor, SENSITIVE_SECTION_KEYS,
} from '@/lib/additional-details/sections'
import { DEFAULT_OPTIONS } from '@/lib/additional-details/options'

// Pure rules for Additional Details — no database needed.

const lists = DEFAULT_OPTIONS
const ctx = (over: Partial<Parameters<typeof applicableSections>[0]> = {}) => ({
  age: 30, gender: 'MALE', maritalStatus: 'MARRIED', employmentStatus: null, matrimonyEligible: false, ...over,
})

describe('Additional Details — section catalogue', () => {
  it('has the 23 sections in order, each with a gate question and a default visibility', () => {
    expect(SECTIONS.map((s) => s.number)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1))
    for (const s of SECTIONS) {
      expect(s.gateQuestion).toBeTruthy()
      expect(s.defaultVisibility).toBeTruthy()
    }
  })

  it('privacy defaults follow rule 2 (Only me for 1–7, 14–19, 22–23; Community for 9, 10, 12, 13, 20, 21)', () => {
    const community = SECTIONS.filter((s) => s.defaultVisibility === 'COMMUNITY').map((s) => s.number)
    expect(community).toEqual([9, 10, 12, 13, 20, 21])
    for (const n of [1, 2, 3, 4, 5, 6, 7, 14, 15, 16, 17, 18, 19, 22, 23]) expect(SECTIONS[n - 1].defaultVisibility).toBe('ONLY_ME')
  })

  it('loans, insurance, adviser and doctor are capped at My Karta', () => {
    for (const k of ['banking', 'insurance', 'adviser', 'doctor']) expect(maxVisibilityFor(k)).toBe('KARTA')
    expect(maxVisibilityFor('hobbies')).toBe('COMMUNITY')
  })

  it('sensitive topics are exactly the ones Step 3 rule 8 lists', () => {
    expect(SENSITIVE_SECTION_KEYS.sort()).toEqual(['adviser', 'banking', 'doctor', 'emergency', 'gov_docs', 'insurance', 'marriage_support', 'wellness'].sort())
  })

  it('no field collects a forbidden identifier', () => {
    const keys = SECTIONS.flatMap((s) => [...(s.fields ?? []), ...(s.row?.fields ?? [])].map((f) => f.key.toLowerCase()))
    for (const bad of ['policynumber', 'accountnumber', 'cardnumber', 'pan', 'cibil', 'survey', 'diagnosis', 'illness', 'medicine', 'disability']) {
      expect(keys.some((k) => k === bad || k.includes(bad)), bad).toBe(false)
    }
  })

  it('sections are hidden when they do not apply (age, gender, marital and working status)', () => {
    const keys = (c: ReturnType<typeof ctx>) => applicableSections(c).map((s) => s.key)
    expect(keys(ctx())).not.toContain('senior')
    expect(keys(ctx({ age: 65 }))).toContain('senior')
    expect(keys(ctx())).not.toContain('students')
    expect(keys(ctx({ age: 22 }))).toContain('students')
    expect(keys(ctx({ employmentStatus: 'STUDENT' }))).toContain('students')
    expect(keys(ctx())).not.toContain('women')
    expect(keys(ctx({ gender: 'FEMALE' }))).toContain('women')
    expect(keys(ctx())).not.toContain('marriage_support')
    expect(keys(ctx({ matrimonyEligible: true }))).toContain('marriage_support')
    const child = keys(ctx({ age: 10, matrimonyEligible: true }))
    for (const k of ['banking', 'insurance', 'adviser', 'vehicles', 'farm', 'house', 'marriage_support', 'career']) expect(child).not.toContain(k)
  })

  it('completeness encourages but never requires', () => {
    expect(completenessScore(['a', 'b', 'c', 'd'], ['a'])).toBe(25)
    expect(completenessScore([], [])).toBe(100)
  })
})

describe('Additional Details — parsing', () => {
  it('drops detail fields unless the answer is Yes, but keeps "needs help" on No', () => {
    const p = parseSectionInput(SECTION_BY_KEY.doctor, { answer: 'NO', values: { doctorName: 'X', doctorNeedsHelp: true } }, lists)
    expect(p.values.doctorName).toBeNull()
    expect(p.values.doctorNeedsHelp).toBe(true)
  })

  it('rejects a visibility wider than the cap', () => {
    expect(() => parseSectionInput(SECTION_BY_KEY.banking, { answer: 'YES', visibility: 'FAMILY' }, lists)).toThrow(SectionInputError)
  })

  it('coerces types and refuses exact amounts', () => {
    const insurance = SECTION_BY_KEY.insurance.row!.fields
    expect(coerceField(insurance.find((f) => f.key === 'renewalMonth')!, '4', lists)).toBe(4)
    expect(() => coerceField(insurance.find((f) => f.key === 'sumInsuredBand')!, '750000', lists)).toThrow(/choose an option/)
  })

  it('ignores empty rows and nested children are parsed', () => {
    const p = parseSectionInput(SECTION_BY_KEY.sports, { answer: 'YES', rows: [{}, { interestId: 'x', achievements: [{ eventName: 'Meet', medal: 'GOLD' }] }] }, lists)
    expect(p.rows).toHaveLength(1)
    expect(p.rows[0].children![0].values).toMatchObject({ eventName: 'Meet', medal: 'GOLD' })
  })

  it('masks registration numbers', () => {
    expect(maskValue('MH12AB1234')).toBe('••••1234')
    expect(maskValue(null)).toBeNull()
  })
})
