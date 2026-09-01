import { z } from 'zod'

export const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
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
