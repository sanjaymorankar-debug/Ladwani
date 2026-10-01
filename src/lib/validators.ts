import { z } from 'zod'

/// One definition of "an acceptable password", so registration, profile
/// claiming and password reset can't drift apart on strength rules.
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')

export const claimInvitationSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
    .optional()
    .or(z.literal('')),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(1, 'Last name is required'),
  // Email is the primary account identifier. Mobile stays supported (existing
  // accounts sign in with it, and it's useful contact info) but is optional.
  email: z.string().min(1, 'Email address is required').email('Invalid email address'),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
    .optional()
    .or(z.literal('')),
  password: passwordSchema,
  confirmPassword: z.string(),
  joinIntent: z.enum(['KARTA', 'JOIN_EXISTING'], {
    errorMap: () => ({ message: 'Please choose how you want to join the community' }),
  }),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms to register' }),
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or mobile number required'),
  password: z.string().min(1, 'Password required'),
})

export const familySchema = z.object({
  name: z.string().min(2, 'Family name is required'),
  surname: z.string().optional(),
  description: z.string().optional(),
  kuladevata: z.string().optional(),
  kuladevi: z.string().optional(),
  gotra: z.string().optional(),
  nativeVillage: z.string().optional(),
  nativeDistrict: z.string().optional(),
  nativeState: z.string().optional(),
  nativeCountry: z.string().default('India'),
})

export const memberSchema = z.object({
  firstName: z.string().min(2, 'First name required'),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'NOT_STATED']),
  dateOfBirth: z.string().optional(),
  bloodGroup: z.string().optional(),
  mobilePrimary: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  currentCity: z.string().optional(),
  currentState: z.string().optional(),
  nativeVillage: z.string().optional(),
  maritalStatus: z.enum(['UNMARRIED', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED', 'NOT_STATED']).default('UNMARRIED'),
})

export const matrimonialProfileSchema = z.object({
  about: z.string().max(1000).optional(),
  heightCm: z.number().min(100).max(220).optional(),
  languages: z.array(z.string()).optional(),
  isVisible: z.boolean().default(false),
  preferences: z.object({
    minAge: z.number().min(18).max(60).optional(),
    maxAge: z.number().min(18).max(70).optional(),
    preferredLocations: z.array(z.string()).optional(),
    educationPreference: z.string().optional(),
    occupationPreference: z.string().optional(),
  }).optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type FamilyInput = z.infer<typeof familySchema>
export type MemberInput = z.infer<typeof memberSchema>
export type MatrimonialProfileInput = z.infer<typeof matrimonialProfileSchema>


/** Indian PIN codes are 6 digits and never start with 0. */
export const PINCODE_REGEX = /^[1-9]\d{5}$/

/**
 * Range checks for the physical fields (§30). Values arrive from forms as
 * strings or numbers; blank means "not provided" and is always valid.
 * Returns a user-facing error message, or null when fine.
 */
export function validatePhysical(input: { heightCm?: unknown; weightKg?: unknown }): string | null {
  const blank = (v: unknown) => v === undefined || v === null || v === ''
  if (!blank(input.heightCm)) {
    const h = Number(input.heightCm)
    if (!Number.isInteger(h) || h < 30 || h > 250) return 'Height must be a whole number between 30 and 250 cm'
  }
  if (!blank(input.weightKg)) {
    const w = Number(input.weightKg)
    if (!Number.isInteger(w) || w < 2 || w > 350) return 'Weight must be a whole number between 2 and 350 kg'
  }
  return null
}

/** Blank is fine; anything else must be a valid Indian PIN when the country is India. */
export function validatePincode(pincode: unknown, country?: unknown): string | null {
  if (pincode === undefined || pincode === null || pincode === '') return null
  if (country && String(country).trim().toLowerCase() !== 'india') return null
  return PINCODE_REGEX.test(String(pincode)) ? null : 'Enter a valid 6-digit PIN code'
}
