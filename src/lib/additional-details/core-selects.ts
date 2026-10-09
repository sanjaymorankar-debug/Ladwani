/**
 * The columns education_records and businesses had before Additional Details
 * extended them. Code that shows these rows outside the Additional Details
 * area selects only these, so marks, marksheets, business contact and support
 * needs never leak past the owner's visibility setting (rule 8).
 */
export const EDUCATION_CORE_SELECT = {
  id: true, memberId: true, level: true, qualification: true, specialization: true, institution: true,
  yearCompleted: true, isHighest: true, isOngoing: true, createdAt: true, updatedAt: true,
} as const

export const BUSINESS_CORE_SELECT = {
  id: true, memberId: true, businessName: true, businessType: true, industry: true, city: true, country: true,
  description: true, website: true, establishedYear: true, incomeRangeId: true, isActive: true, createdAt: true, updatedAt: true,
} as const
