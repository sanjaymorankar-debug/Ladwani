import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined, fmt = 'dd MMM yyyy'): string {
  if (!date) return '—'
  return format(new Date(date), fmt)
}

export function timeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function generateMemberNumber(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 90000) + 10000
  return `MEM-${year}-${rand}`
}

export function generateFamilyNumber(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 90000) + 10000
  return `FAM-${year}-${rand}`
}

export function calculateAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function truncate(str: string, length = 100): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export const VISIBILITY_LEVELS = {
  PUBLIC_COMMUNITY: 'Public (Community)',
  REGISTERED_MEMBERS: 'Registered Members',
  SAME_AREA: 'Same Area',
  SAME_FAMILY: 'Same Family Only',
  MATRIMONY_ONLY: 'Matrimony Only',
  ADMIN_OPERATOR: 'Admin/Operator Only',
  PRIVATE: 'Private (Only Me)',
} as const

export const MARITAL_STATUS_LABELS = {
  UNMARRIED: 'Unmarried',
  MARRIED: 'Married',
  WIDOWED: 'Widowed',
  DIVORCED: 'Divorced',
  SEPARATED: 'Separated',
  NOT_STATED: 'Not Stated',
} as const

export const GENDER_LABELS = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  NOT_STATED: 'Prefer not to say',
} as const

// Type-safe label lookups (handles any string safely)
export function genderLabel(g: string): string {
  return GENDER_LABELS[g as keyof typeof GENDER_LABELS] ?? g
}
export function maritalLabel(s: string): string {
  return MARITAL_STATUS_LABELS[s as keyof typeof MARITAL_STATUS_LABELS] ?? s
}
