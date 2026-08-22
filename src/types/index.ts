export interface User {
  id: string;
  email?: string | null;
  mobile?: string | null;
  status: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  member?: Member | null;
  roles: string[];
}

export interface Member {
  id: string;
  memberNumber?: string | null;
  userId?: string | null;
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  dateOfBirth?: Date | string | null;
  bloodGroup?: string | null;
  mobilePrimary?: string | null;
  email?: string | null;
  profilePhotoId?: string | null;
  biography?: string | null;
  currentCity?: string | null;
  currentState?: string | null;
  currentCountry?: string | null;
  nativeVillage?: string | null;
  nativeState?: string | null;
  maritalStatus?: string;
  employmentStatus?: string | null;
  occupationCategory?: string | null;
  status?: string;
  verificationStatus?: string;
  createdAt?: Date | string;
  families?: FamilyMember[];
  educationRecords?: EducationRecord[];
  employmentRecords?: EmploymentRecord[];
  skills?: MemberSkill[];
  matrimonialProfile?: MatrimonialProfile | null;
}

export interface Family {
  id: string;
  registrationNumber?: string | null;
  name: string;
  surname?: string | null;
  description?: string | null;
  kuladevata?: string | null;
  kuladevi?: string | null;
  gotra?: string | null;
  nativeVillage?: string | null;
  nativeDistrict?: string | null;
  nativeState?: string | null;
  nativeCountry?: string;
  kartaMemberId?: string | null;
  status?: string;
  verificationStatus?: string;
  createdAt?: Date | string;
  members?: FamilyMember[];
}

export interface FamilyMember {
  id: string;
  familyId: string;
  memberId: string;
  isKarta: boolean;
  member?: Member;
  family?: Family;
}

export interface RelationshipType {
  id: string;
  code: string;
  label: string;
  inverseCode?: string | null;
  isSpouse: boolean;
}

export interface MemberRelationship {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  relationshipTypeId: string;
  isActive: boolean;
  fromMember?: Member;
  toMember?: Member;
  relationshipType?: RelationshipType;
}

export interface EducationRecord {
  id: string;
  memberId: string;
  level?: string | null;
  qualification?: string | null;
  specialization?: string | null;
  institution?: string | null;
  yearCompleted?: number | null;
  isHighest?: boolean;
}

export interface EmploymentRecord {
  id: string;
  memberId: string;
  employmentType?: string | null;
  employerName?: string | null;
  designation?: string | null;
  isCurrent?: boolean;
}

export interface MemberSkill {
  memberId: string;
  skillId: string;
  level?: string | null;
  skill?: { name: string; category?: string | null };
}

export interface MatrimonialProfile {
  id: string;
  memberId: string;
  isVisible: boolean;
  about?: string | null;
  heightCm?: number | null;
  languages?: string[];
  member?: Member;
  preferences?: MatrimonialPreference | null;
}

export interface MatrimonialPreference {
  id: string;
  matrimonialProfileId: string;
  minAge?: number | null;
  maxAge?: number | null;
  preferredGender?: string | null;
  preferredLocations?: string[];
  educationPreference?: string | null;
  occupationPreference?: string | null;
}

export interface Post {
  id: string;
  authorId: string;
  title?: string | null;
  content: string;
  visibility: string;
  status: string;
  isPinned?: boolean;
  isAnnouncement?: boolean;
  createdAt: Date | string;
  author?: { id: string; member?: { firstName: string; lastName?: string | null; profilePhotoId?: string | null } | null };
  postType?: { code: string; label: string; icon?: string | null } | null;
  _count?: { comments: number; reactions: number };
}

export interface Notification {
  id: string;
  type: string;
  title?: string | null;
  body?: string | null;
  isRead: boolean;
  createdAt: Date | string;
}

export interface Approval {
  id: string;
  actionCode: string;
  entityType?: string | null;
  entityId?: string | null;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  status: string;
  reason?: string | null;
  reviewNote?: string | null;
  submittedAt: Date | string;
  submitter?: { email?: string | null; member?: { firstName: string; lastName?: string | null } | null };
}

export interface Area {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  children?: Area[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
