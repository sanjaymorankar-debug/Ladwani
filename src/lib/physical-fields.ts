import { prisma } from '@/lib/prisma'

/**
 * Which optional physical fields the community collects (section 16). Admins
 * can switch each off in Admin > Settings; a disabled field is hidden on the
 * profile form and refused by the API, so nobody is asked for data the
 * community has decided not to hold.
 */
export const PHYSICAL_FIELDS = [
  { key: 'heightCm', label: 'Height' },
  { key: 'weightKg', label: 'Weight' },
  { key: 'bodyType', label: 'Body type' },
  { key: 'bloodGroup', label: 'Blood group' },
  { key: 'physicalDisability', label: 'Physical disability' },
] as const

export type PhysicalFieldKey = (typeof PHYSICAL_FIELDS)[number]['key']
export type PhysicalFieldConfig = Record<PhysicalFieldKey, boolean>

export const PHYSICAL_FIELDS_SETTING_KEY = 'profile.physical_fields'

export const DEFAULT_PHYSICAL_CONFIG: PhysicalFieldConfig = {
  heightCm: true, weightKg: true, bodyType: true, bloodGroup: true, physicalDisability: true,
}

export async function getPhysicalFieldConfig(): Promise<PhysicalFieldConfig> {
  const row = await prisma.setting.findUnique({ where: { key: PHYSICAL_FIELDS_SETTING_KEY } })
  const stored = (row?.value ?? {}) as Partial<PhysicalFieldConfig>
  const out = { ...DEFAULT_PHYSICAL_CONFIG }
  for (const f of PHYSICAL_FIELDS) if (typeof stored[f.key] === 'boolean') out[f.key] = stored[f.key]!
  return out
}
