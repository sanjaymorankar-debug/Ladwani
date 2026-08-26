export const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'NOT_STATED'] as const
export type Gender = (typeof GENDERS)[number]

export const MARITAL_STATUSES = ['UNMARRIED', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED', 'NOT_STATED'] as const
export type MaritalStatus = (typeof MARITAL_STATUSES)[number]

export const MEMBER_STATUSES = ['ACTIVE', 'INACTIVE', 'DECEASED', 'SUSPENDED'] as const
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

export const USER_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const FAMILY_STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE', 'MERGED', 'ARCHIVED'] as const
export type FamilyStatus = (typeof FAMILY_STATUSES)[number]

export const VERIFICATION_STATUSES = ['UNVERIFIED', 'VERIFIED', 'REJECTED'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export const JOIN_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'DECLINED'] as const
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number]

export const APPROVAL_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'ESCALATED'] as const
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

export const MATRIMONY_INTEREST_KINDS = ['INTEREST', 'CONTACT_REQUEST'] as const
export type MatrimonyInterestKind = (typeof MATRIMONY_INTEREST_KINDS)[number]

export const MATRIMONY_INTEREST_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'] as const
export type MatrimonyInterestStatus = (typeof MATRIMONY_INTEREST_STATUSES)[number]

export const POST_STATUSES = ['PENDING_APPROVAL', 'PUBLISHED', 'REJECTED', 'REMOVED'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const REACTION_TYPES = ['LIKE', 'LOVE', 'CELEBRATE', 'SUPPORT'] as const
export type ReactionType = (typeof REACTION_TYPES)[number]

export const REPORT_STATUSES = ['PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const ASSET_STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export const ASSET_AVAILABILITY_STATUSES = ['AVAILABLE', 'PENDING', 'RESERVED', 'BLOCKED', 'MAINTENANCE', 'HOLIDAY'] as const
export type AssetAvailabilityStatus = (typeof ASSET_AVAILABILITY_STATUSES)[number]

export const ASSET_PRICE_TYPES = ['BASE', 'SEASONAL', 'WEEKEND', 'COMMUNITY_MEMBER'] as const
export type AssetPriceType = (typeof ASSET_PRICE_TYPES)[number]

export const BOOKING_TYPES = ['INSTANT', 'REQUEST'] as const
export type BookingType = (typeof BOOKING_TYPES)[number]

export const BOOKING_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'DECLINED',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'EXPIRED',
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]
