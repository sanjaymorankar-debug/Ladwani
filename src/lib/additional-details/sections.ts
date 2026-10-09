/**
 * The 23 Additional Details sections, described once and shared by the wizard
 * (client) and the API (server) so the two cannot drift — the same idea as
 * src/lib/profile-details.ts. Nothing here touches the database.
 *
 * Every section opens with a Yes / No / Prefer-not-to-say question. Detail
 * fields show (and are stored) only when the answer is Yes; "needs help"
 * fields marked `onAnswers: ['YES', 'NO']` also show on No, because someone
 * without insurance or a doctor is exactly who might need help finding one.
 * Anything not shown is dropped on the server before saving.
 */

export type Answer = 'YES' | 'NO' | 'PREFER_NOT'
export const ANSWERS: { value: Answer; label: string }[] = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'PREFER_NOT', label: 'Prefer not to say' },
]

// ── Visibility (rule 2) ─────────────────────────────────────────────
// Ordered narrowest → widest; each level includes everyone in the levels
// before it. COMMUNITY_BODIES = Admin, Operators and the District team for
// the member's district. COMMUNITY = every signed-in community member.
export const VISIBILITY_LEVELS = ['ONLY_ME', 'KARTA', 'FAMILY', 'COMMUNITY_BODIES', 'COMMUNITY'] as const
export type Visibility = (typeof VISIBILITY_LEVELS)[number]
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  ONLY_ME: 'Only me',
  KARTA: 'My Karta',
  FAMILY: 'My family',
  COMMUNITY_BODIES: 'Community bodies',
  COMMUNITY: 'Community (all members)',
}
export const visibilityRank = (v: string) => VISIBILITY_LEVELS.indexOf(v as Visibility)

export type FieldType =
  | 'text' | 'textarea' | 'select' | 'multi' | 'bool' | 'month' | 'monthNum'
  | 'year' | 'number' | 'tags' | 'interest' | 'familyMember' | 'file' | 'district'

export interface ShowWhen {
  field: string
  equals?: unknown
  includes?: string
}

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  /** Option list key in options.ts (select / multi). */
  list?: string
  /** Gate answers under which the field is shown. Default ['YES']. */
  onAnswers?: Answer[]
  showWhen?: ShowWhen
  max?: number
  help?: string
  /** Shown masked (last 4 characters) to anyone but the editor. */
  masked?: boolean
  /** Never shown to other viewers, whatever the section visibility. */
  editorOnly?: boolean
  /** Lives on the existing `members` row rather than the new tables. */
  memberColumn?: boolean
  /** interest picker: limit to sports. */
  sportsOnly?: boolean
  /** File purpose for type 'file'. */
  filePurpose?: 'MARKSHEET' | 'CERTIFICATE'
}

/** A "needs help / needs support" question that can become a support request. */
export interface SupportDef {
  /** Section-level boolean/array field, or row-level field when `row` is set. */
  field: string
  category: SupportCategory
  row?: boolean
  noteField?: string
  /** 'answer' means the section's own gate answer YES is the "needs" signal. */
  kind?: 'bool' | 'multi' | 'answer'
}

export type SupportCategory =
  | 'INSURANCE' | 'DOCTOR' | 'INVESTMENT' | 'SERVICING' | 'LOAN' | 'BANKING' | 'EDUCATION' | 'SPORTS'
  | 'HOBBY' | 'CAREER' | 'BUSINESS' | 'SENIOR' | 'STUDENT' | 'WOMEN' | 'GOV_DOCS' | 'MARRIAGE'

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  INSURANCE: 'Insurance', DOCTOR: 'Doctor', INVESTMENT: 'Investment guidance', SERVICING: 'Vehicle servicing',
  LOAN: 'Loan', BANKING: 'Banking', EDUCATION: 'Education', SPORTS: 'Sports coaching', HOBBY: 'Hobby',
  CAREER: 'Career', BUSINESS: 'Business', SENIOR: 'Senior citizen', STUDENT: 'Student', WOMEN: "Women's support",
  GOV_DOCS: 'Government documents', MARRIAGE: 'Marriage support',
}

export interface RowDef {
  label: string
  fields: FieldDef[]
  /** Nested child rows (sports → medals and certificates). */
  children?: { key: string; label: string; fields: FieldDef[] }
  max?: number
}

export interface ApplicabilityContext {
  age: number | null
  gender: string
  maritalStatus: string
  employmentStatus: string | null
  matrimonyEligible: boolean
}

export interface SectionDef {
  key: string
  number: number
  title: string
  gateQuestion: string
  intro?: string
  defaultVisibility: Visibility
  /** Rule 2 cap — never wider than this, except via an opted-in support request. */
  maxVisibility?: Visibility
  fields?: FieldDef[]
  row?: RowDef
  support?: SupportDef[]
  /** Rule 9 — hidden (and refused by the server) when this returns false. */
  appliesTo?: (ctx: ApplicabilityContext) => boolean
  /** Step 3 rule 8 — never creates or auto-joins a group. */
  sensitive?: boolean
  /** A short "what we never collect here" line shown in the form. */
  neverCollect?: string
}

const HELP: Answer[] = ['YES', 'NO']
const adult = (ctx: ApplicabilityContext) => ctx.age === null || ctx.age >= 18

export const SECTIONS: SectionDef[] = [
  {
    key: 'insurance', number: 1, title: 'Insurance', gateQuestion: 'Do you have any insurance?',
    defaultVisibility: 'ONLY_ME', maxVisibility: 'KARTA', sensitive: true, appliesTo: adult,
    neverCollect: 'We never ask for policy numbers.',
    row: {
      label: 'Policy', max: 10,
      fields: [
        { key: 'insuranceType', label: 'Type', type: 'select', list: 'INSURANCE_TYPE' },
        { key: 'insurerName', label: 'Insurer name', type: 'text' },
        { key: 'sumInsuredBand', label: 'Sum insured', type: 'select', list: 'SUM_INSURED_BAND' },
        { key: 'renewalMonth', label: 'Renewal month', type: 'monthNum', list: 'MONTH' },
      ],
    },
    fields: [
      { key: 'insuranceNeedsHelp', label: 'Do you need help with insurance?', type: 'bool', onAnswers: HELP },
      { key: 'insuranceHelpNote', label: 'What help do you need?', type: 'textarea', onAnswers: HELP, showWhen: { field: 'insuranceNeedsHelp', equals: true }, max: 500 },
    ],
    support: [{ field: 'insuranceNeedsHelp', category: 'INSURANCE', noteField: 'insuranceHelpNote' }],
  },
  {
    key: 'doctor', number: 2, title: 'Family doctor', gateQuestion: 'Do you have a family doctor?',
    defaultVisibility: 'ONLY_ME', maxVisibility: 'KARTA', sensitive: true,
    neverCollect: 'We never ask about any illness, diagnosis or treatment.',
    fields: [
      { key: 'doctorName', label: 'Doctor name', type: 'text' },
      { key: 'doctorSpeciality', label: 'Speciality', type: 'select', list: 'DOCTOR_SPECIALITY' },
      { key: 'doctorClinic', label: 'Clinic or hospital', type: 'text' },
      { key: 'doctorCity', label: 'City', type: 'text' },
      { key: 'doctorContact', label: 'Contact number', type: 'text', max: 20 },
      { key: 'doctorNeedsHelp', label: 'Do you need help finding a doctor?', type: 'bool', onAnswers: HELP },
    ],
    support: [{ field: 'doctorNeedsHelp', category: 'DOCTOR' }],
  },
  {
    key: 'adviser', number: 3, title: 'Investment manager / financial adviser', gateQuestion: 'Do you have an investment manager or financial adviser?',
    defaultVisibility: 'ONLY_ME', maxVisibility: 'KARTA', sensitive: true, appliesTo: adult,
    neverCollect: 'We never ask for portfolio values or account numbers.',
    fields: [
      { key: 'adviserName', label: 'Name or firm', type: 'text' },
      { key: 'adviserType', label: 'Type', type: 'select', list: 'ADVISER_TYPE' },
      { key: 'adviserContact', label: 'Contact', type: 'text', max: 60 },
      { key: 'adviserNeedsGuidance', label: 'Do you need guidance on investment?', type: 'bool', onAnswers: HELP },
    ],
    support: [{ field: 'adviserNeedsGuidance', category: 'INVESTMENT' }],
  },
  {
    key: 'vehicles', number: 4, title: 'Vehicles and servicing', gateQuestion: 'Do you own a vehicle?',
    defaultVisibility: 'ONLY_ME', appliesTo: adult,
    row: {
      label: 'Vehicle', max: 10,
      fields: [
        { key: 'vehicleType', label: 'Vehicle type', type: 'select', list: 'VEHICLE_TYPE' },
        { key: 'make', label: 'Make', type: 'text' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'year', label: 'Year', type: 'year' },
        { key: 'fuelType', label: 'Fuel type', type: 'select', list: 'FUEL_TYPE' },
        { key: 'lastServiceMonth', label: 'Last service', type: 'month' },
        { key: 'nextServiceDueMonth', label: 'Next service due', type: 'month' },
        { key: 'preferredGarage', label: 'Preferred garage or service centre', type: 'text' },
        { key: 'registrationNumber', label: 'Registration number (optional)', type: 'text', masked: true, max: 15, help: 'Shown to others as ••••1234.' },
        { key: 'needsServicingSupport', label: 'Do you need servicing support?', type: 'bool' },
        { key: 'servicingSupportNote', label: 'What support?', type: 'textarea', showWhen: { field: 'needsServicingSupport', equals: true }, max: 500 },
      ],
    },
    support: [{ field: 'needsServicingSupport', category: 'SERVICING', row: true, noteField: 'servicingSupportNote' }],
  },
  {
    key: 'banking', number: 5, title: 'Banking and loan requirements', gateQuestion: 'Do you need a loan?',
    defaultVisibility: 'ONLY_ME', maxVisibility: 'KARTA', sensitive: true, appliesTo: adult,
    neverCollect: 'We never ask for bank account numbers, card numbers, CIBIL score or PAN.',
    row: {
      label: 'Loan needed', max: 5,
      fields: [
        { key: 'loanType', label: 'Loan type', type: 'select', list: 'LOAN_TYPE' },
        { key: 'amountBand', label: 'Approximate amount', type: 'select', list: 'LOAN_AMOUNT_BAND' },
        { key: 'purpose', label: 'Purpose', type: 'text', max: 191 },
        { key: 'neededByMonth', label: 'Needed by', type: 'month' },
      ],
    },
    fields: [
      { key: 'hasExistingLoans', label: 'Do you have existing loans?', type: 'bool', onAnswers: HELP },
      { key: 'existingLoanTypes', label: 'Types of existing loans (types only)', type: 'multi', list: 'LOAN_TYPE', onAnswers: HELP, showWhen: { field: 'hasExistingLoans', equals: true } },
      { key: 'otherBankingNeeds', label: 'Other banking needs', type: 'multi', list: 'BANKING_NEED', onAnswers: HELP },
    ],
    support: [
      { field: 'answer', category: 'LOAN', kind: 'answer' },
      { field: 'otherBankingNeeds', category: 'BANKING', kind: 'multi' },
    ],
  },
  {
    key: 'farm', number: 6, title: 'Farm holding', gateQuestion: 'Do you hold farm land?',
    defaultVisibility: 'ONLY_ME', appliesTo: adult,
    neverCollect: 'We never ask for 7/12 extracts or survey numbers.',
    row: {
      label: 'Farm', max: 10,
      fields: [
        { key: 'districtAreaId', label: 'District', type: 'district' },
        { key: 'taluka', label: 'Taluka', type: 'text' },
        { key: 'village', label: 'Village', type: 'text' },
        { key: 'areaValue', label: 'Area', type: 'number' },
        { key: 'areaUnit', label: 'Unit', type: 'select', list: 'LAND_UNIT' },
        { key: 'ownership', label: 'Ownership', type: 'select', list: 'FARM_OWNERSHIP' },
        { key: 'irrigated', label: 'Irrigated?', type: 'bool' },
        { key: 'mainCrops', label: 'Main crops', type: 'text' },
      ],
    },
  },
  {
    key: 'house', number: 7, title: 'House', gateQuestion: 'Would you like to add details about your house?',
    defaultVisibility: 'ONLY_ME', appliesTo: adult,
    intro: 'Your address is taken from your current address on the profile — it is not asked again here.',
    fields: [
      { key: 'houseOwnership', label: 'The house is', type: 'select', list: 'HOUSE_OWNERSHIP' },
      { key: 'houseType', label: 'Type', type: 'select', list: 'HOUSE_TYPE' },
      { key: 'houseWantsToBuy', label: 'Do you want to buy a house?', type: 'bool', showWhen: { field: 'houseOwnership', equals: 'RENTED' } },
    ],
  },
  {
    key: 'education', number: 8, title: 'Education and support', gateQuestion: 'Would you like to add marks or ask for education support?',
    defaultVisibility: 'ONLY_ME',
    intro: 'These are your existing education records — add marks, board and an optional marksheet to each.',
    row: {
      label: 'Degree or class', max: 15,
      fields: [
        { key: 'qualification', label: 'Degree or class', type: 'text' },
        { key: 'institution', label: 'School / college', type: 'text' },
        { key: 'boardUniversity', label: 'Board or university', type: 'text' },
        { key: 'yearCompleted', label: 'Passing year', type: 'year' },
        { key: 'marksType', label: 'Marks as', type: 'select', list: 'MARKS_TYPE' },
        { key: 'marksValue', label: 'Marks obtained', type: 'text', max: 10 },
        { key: 'marksScale', label: 'Scale', type: 'select', list: 'MARKS_SCALE' },
        { key: 'marksheetFileId', label: 'Marksheet (optional, PDF/JPG/PNG up to 5 MB)', type: 'file', filePurpose: 'MARKSHEET' },
      ],
    },
    fields: [
      { key: 'eduNeedsSupport', label: 'Do you need support for education?', type: 'bool', onAnswers: HELP },
      { key: 'eduSupportTypes', label: 'Support type', type: 'multi', list: 'EDU_SUPPORT_TYPE', onAnswers: HELP, showWhen: { field: 'eduNeedsSupport', equals: true } },
      { key: 'eduSupportAmountBand', label: 'Approximate amount', type: 'select', list: 'SUPPORT_AMOUNT_BAND', onAnswers: HELP, showWhen: { field: 'eduNeedsSupport', equals: true } },
      { key: 'eduSupportNote', label: 'Note', type: 'textarea', onAnswers: HELP, showWhen: { field: 'eduNeedsSupport', equals: true }, max: 500 },
    ],
    support: [{ field: 'eduNeedsSupport', category: 'EDUCATION', noteField: 'eduSupportNote' }],
  },
  {
    key: 'sports', number: 9, title: 'Sports', gateQuestion: 'Do you play a sport?',
    defaultVisibility: 'COMMUNITY',
    row: {
      label: 'Sport', max: 10,
      fields: [
        { key: 'interestId', label: 'Sport', type: 'interest', sportsOnly: true },
        { key: 'level', label: 'Level', type: 'select', list: 'SPORT_LEVEL' },
        { key: 'needsCoachingSupport', label: 'Do you need support for sports coaching?', type: 'bool' },
        { key: 'supportTypes', label: 'Support type', type: 'multi', list: 'SPORT_SUPPORT_TYPE', showWhen: { field: 'needsCoachingSupport', equals: true } },
        { key: 'supportNote', label: 'Note', type: 'textarea', showWhen: { field: 'needsCoachingSupport', equals: true }, max: 500 },
      ],
      children: {
        key: 'achievements', label: 'Certifications and medals',
        fields: [
          { key: 'eventName', label: 'Event name', type: 'text' },
          { key: 'year', label: 'Year', type: 'year' },
          { key: 'medal', label: 'Medal', type: 'select', list: 'MEDAL' },
          { key: 'certificateFileId', label: 'Certificate (optional)', type: 'file', filePurpose: 'CERTIFICATE' },
        ],
      },
    },
    support: [{ field: 'needsCoachingSupport', category: 'SPORTS', row: true, noteField: 'supportNote' }],
  },
  {
    key: 'hobbies', number: 10, title: 'Hobbies and interests', gateQuestion: 'Would you like to add your hobbies and interests?',
    defaultVisibility: 'COMMUNITY',
    intro: 'Each hobby has a community group. You will be added to matching groups and can leave any of them at any time.',
    row: {
      label: 'Hobby', max: 30,
      fields: [
        { key: 'interestId', label: 'Hobby', type: 'interest' },
        { key: 'detail', label: 'Which one? (e.g. instrument or dance form)', type: 'text', max: 100 },
        { key: 'level', label: 'Level', type: 'select', list: 'HOBBY_LEVEL' },
        { key: 'canTeach', label: 'I can teach or guide others', type: 'bool' },
        { key: 'needsSupport', label: 'I need support', type: 'bool' },
        { key: 'supportTypes', label: 'Support type', type: 'multi', list: 'HOBBY_SUPPORT_TYPE', showWhen: { field: 'needsSupport', equals: true } },
        { key: 'supportNote', label: 'Note', type: 'textarea', showWhen: { field: 'needsSupport', equals: true }, max: 500 },
      ],
    },
    support: [{ field: 'needsSupport', category: 'HOBBY', row: true, noteField: 'supportNote' }],
  },
  {
    key: 'career', number: 11, title: 'Career and work', gateQuestion: 'Would you like to add career and work details?',
    defaultVisibility: 'ONLY_ME', appliesTo: (c) => c.age === null || c.age >= 15,
    fields: [
      { key: 'careerLookingFor', label: 'Looking for', type: 'multi', list: 'CAREER_LOOKING_FOR' },
      { key: 'careerSkills', label: 'Key skills', type: 'tags', max: 15 },
      { key: 'careerPreferredCity', label: 'Preferred city', type: 'text' },
      { key: 'careerExperienceBand', label: 'Experience', type: 'select', list: 'EXPERIENCE_BAND' },
      { key: 'careerCanOffer', label: 'I can offer', type: 'multi', list: 'CAREER_CAN_OFFER' },
      { key: 'careerOfferField', label: 'In which field?', type: 'text', showWhen: { field: 'careerCanOffer', includes: '*' } },
      { key: 'careerSupportNeeds', label: 'I need support with', type: 'multi', list: 'CAREER_SUPPORT' },
    ],
    support: [{ field: 'careerSupportNeeds', category: 'CAREER', kind: 'multi' }],
  },
  {
    key: 'business', number: 12, title: 'Own business or profession listing', gateQuestion: 'Do you run a business or practice a profession?',
    defaultVisibility: 'COMMUNITY', appliesTo: (c) => c.age === null || c.age >= 16,
    row: {
      label: 'Business', max: 10,
      fields: [
        { key: 'businessName', label: 'Business name', type: 'text' },
        { key: 'businessType', label: 'Category', type: 'select', list: 'BUSINESS_CATEGORY' },
        { key: 'description', label: 'Short description', type: 'textarea', max: 500 },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'contact', label: 'Contact', type: 'text', max: 60 },
        { key: 'website', label: 'Website', type: 'text', max: 191 },
        { key: 'showInDirectory', label: 'Show in community business directory', type: 'bool' },
        { key: 'supportNeeds', label: 'I need support with', type: 'multi', list: 'BUSINESS_SUPPORT' },
      ],
    },
    support: [{ field: 'supportNeeds', category: 'BUSINESS', row: true, kind: 'multi' }],
  },
  {
    key: 'skills_share', number: 13, title: 'Skills I can share and help I can give', gateQuestion: 'Can you share a skill or give help to others?',
    defaultVisibility: 'COMMUNITY',
    fields: [
      { key: 'teachSubjects', label: 'I can teach or mentor (subject or skill)', type: 'text' },
      { key: 'teachMode', label: 'How', type: 'select', list: 'TEACH_MODE' },
      { key: 'teachFeeMode', label: 'Free or paid', type: 'select', list: 'TEACH_FEE' },
      { key: 'guidanceFields', label: 'I can give professional guidance in', type: 'multi', list: 'GUIDANCE_FIELD' },
      { key: 'volunteerReady', label: 'Ready to volunteer for community events?', type: 'bool' },
      { key: 'volunteerHoursBand', label: 'Hours per month', type: 'select', list: 'HOURS_BAND', showWhen: { field: 'volunteerReady', equals: true } },
      { key: 'bloodGroup', label: 'Blood group', type: 'select', list: 'BLOOD_GROUP', memberColumn: true, editorOnly: true },
      { key: 'willingToDonateBlood', label: 'Willing to donate blood?', type: 'bool', editorOnly: true, help: 'Shown only in the blood donor finder. Your number is shared only if you accept a request.' },
      { key: 'lastDonatedMonth', label: 'Last donated', type: 'month', editorOnly: true, showWhen: { field: 'willingToDonateBlood', equals: true } },
    ],
  },
  {
    key: 'wellness', number: 14, title: 'Health and fitness (wellness only)', gateQuestion: 'Would you like to add wellness and fitness details?',
    defaultVisibility: 'ONLY_ME', sensitive: true,
    neverCollect: 'We never ask about illnesses, diagnoses, medicines or disability.',
    fields: [
      { key: 'wellnessActivities', label: 'Regular activity', type: 'multi', list: 'WELLNESS_ACTIVITY' },
      { key: 'wellnessWants', label: 'I would like', type: 'multi', list: 'WELLNESS_WANT' },
    ],
  },
  {
    key: 'senior', number: 15, title: 'Senior citizen needs', gateQuestion: 'Would you like to tell us about any needs?',
    defaultVisibility: 'ONLY_ME', appliesTo: (c) => c.age !== null && c.age >= 60,
    fields: [
      { key: 'seniorLivesWith', label: 'Lives', type: 'select', list: 'SENIOR_LIVES' },
      { key: 'seniorNeeds', label: 'Needs', type: 'multi', list: 'SENIOR_NEED' },
      { key: 'seniorEmergencyMemberId', label: 'Emergency contact (family member)', type: 'familyMember' },
    ],
    support: [{ field: 'seniorNeeds', category: 'SENIOR', kind: 'multi' }],
  },
  {
    key: 'students', number: 16, title: 'Children and students', gateQuestion: 'Would you like to add study details or needs?',
    defaultVisibility: 'ONLY_ME', appliesTo: (c) => (c.age !== null && c.age < 25) || c.employmentStatus === 'STUDENT',
    fields: [
      { key: 'studentClassCourse', label: 'Class or course', type: 'text' },
      { key: 'studentCareerInterest', label: 'Career interest', type: 'text' },
      { key: 'studentNeeds', label: 'Needs', type: 'multi', list: 'STUDENT_NEED' },
      { key: 'studentExamName', label: 'Which exam?', type: 'text', max: 60, showWhen: { field: 'studentNeeds', includes: 'COMPETITIVE_EXAM' } },
    ],
    support: [{ field: 'studentNeeds', category: 'STUDENT', kind: 'multi' }],
  },
  {
    key: 'women', number: 17, title: "Women's support", gateQuestion: 'Would you like to tell us about your interests or needs?',
    defaultVisibility: 'ONLY_ME', appliesTo: (c) => c.gender === 'FEMALE' && (c.age === null || c.age >= 18),
    fields: [
      { key: 'womenInterests', label: 'Interested in', type: 'multi', list: 'WOMEN_INTEREST' },
      { key: 'womenNeeds', label: 'Needs', type: 'multi', list: 'WOMEN_NEED' },
    ],
    support: [{ field: 'womenNeeds', category: 'WOMEN', kind: 'multi' }],
  },
  {
    key: 'gov_docs', number: 18, title: 'Government documents and scheme help', gateQuestion: 'Do you need help with any government document or scheme?',
    defaultVisibility: 'ONLY_ME', sensitive: true,
    neverCollect: 'Tick what you need help with only — never enter document numbers or upload copies here.',
    fields: [{ key: 'govDocNeeds', label: 'I need help with', type: 'multi', list: 'GOV_DOC_NEED' }],
    support: [{ field: 'govDocNeeds', category: 'GOV_DOCS', kind: 'multi' }],
  },
  {
    key: 'housing', number: 19, title: 'Housing and relocation', gateQuestion: 'Are you looking to buy, sell or rent, or moving city?',
    defaultVisibility: 'ONLY_ME', appliesTo: (c) => c.age === null || c.age >= 16,
    fields: [
      { key: 'housingLookingTo', label: 'Looking to', type: 'multi', list: 'HOUSING_LOOKING_TO' },
      { key: 'housingCity', label: 'City', type: 'text' },
      { key: 'housingBudgetBand', label: 'Budget', type: 'select', list: 'BUDGET_BAND' },
      { key: 'relocatingCity', label: 'Moving to a new city for study or work — which city?', type: 'text' },
      { key: 'relocatingWantsContacts', label: 'Would you like local community contacts there?', type: 'bool' },
    ],
  },
  {
    key: 'travel', number: 20, title: 'Travel and events', gateQuestion: 'Are you interested in community travel or events?',
    defaultVisibility: 'COMMUNITY',
    fields: [
      { key: 'travelInterests', label: 'Interested in', type: 'multi', list: 'TRAVEL_INTEREST' },
      { key: 'travelCanHost', label: 'Ready to host or organise?', type: 'bool' },
    ],
  },
  {
    key: 'culture', number: 21, title: 'Language, culture and social preferences', gateQuestion: 'Would you like to add language and culture preferences?',
    defaultVisibility: 'COMMUNITY',
    fields: [
      { key: 'languages', label: 'Languages spoken', type: 'tags', max: 15, memberColumn: true },
      { key: 'motherTongue', label: 'Mother tongue', type: 'text' },
      { key: 'cultureInterests', label: 'Interested in', type: 'multi', list: 'CULTURE_INTEREST' },
      { key: 'openToCityFriends', label: 'Open to new friends in my city', type: 'bool' },
      { key: 'openToMulGaon', label: 'Open to members from my Mul Gaon', type: 'bool' },
      { key: 'openToProfession', label: 'Open to people in my profession', type: 'bool' },
    ],
  },
  {
    key: 'marriage_support', number: 22, title: 'Marriage-related support', gateQuestion: 'Would you like help with anything marriage-related?',
    defaultVisibility: 'ONLY_ME', sensitive: true, appliesTo: (c) => c.matrimonyEligible && (c.age === null || c.age >= 18),
    fields: [{ key: 'marriageSupportNeeds', label: 'I need help with', type: 'multi', list: 'MARRIAGE_SUPPORT' }],
    support: [{ field: 'marriageSupportNeeds', category: 'MARRIAGE', kind: 'multi' }],
  },
  {
    key: 'emergency', number: 23, title: 'Emergency readiness', gateQuestion: 'Would you like to add emergency details?',
    defaultVisibility: 'ONLY_ME', sensitive: true,
    fields: [
      { key: 'emergencyContactMemberId', label: 'Emergency contact (family member)', type: 'familyMember' },
      { key: 'canHelpEmergency', label: 'Can you help others in an emergency?', type: 'bool' },
      { key: 'emergencyHelpTypes', label: 'How can you help?', type: 'multi', list: 'EMERGENCY_HELP', showWhen: { field: 'canHelpEmergency', equals: true } },
    ],
  },
]

export const SECTION_BY_KEY: Record<string, SectionDef> = Object.fromEntries(SECTIONS.map((s) => [s.key, s]))
export const SENSITIVE_SECTION_KEYS = SECTIONS.filter((s) => s.sensitive).map((s) => s.key)

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/** Rule 2: the widest visibility a section may be set to. */
export function maxVisibilityFor(sectionKey: string): Visibility {
  return SECTION_BY_KEY[sectionKey]?.maxVisibility ?? 'COMMUNITY'
}

export function sectionApplies(section: SectionDef, ctx: ApplicabilityContext): boolean {
  return section.appliesTo ? section.appliesTo(ctx) : true
}

export function applicableSections(ctx: ApplicabilityContext): SectionDef[] {
  return SECTIONS.filter((s) => sectionApplies(s, ctx))
}

/** Whether a field is shown for this answer and these sibling values. */
export function fieldVisible(field: FieldDef, answer: string | null | undefined, values: Record<string, unknown>): boolean {
  const onAnswers = field.onAnswers ?? ['YES']
  if (!answer || !onAnswers.includes(answer as Answer)) return false
  return showWhenHolds(field.showWhen, values)
}

/** Row fields are only reachable when the section answer is Yes. */
export function rowFieldVisible(field: FieldDef, values: Record<string, unknown>): boolean {
  return showWhenHolds(field.showWhen, values)
}

function showWhenHolds(rule: ShowWhen | undefined, values: Record<string, unknown>): boolean {
  if (!rule) return true
  const v = values[rule.field]
  if (rule.includes !== undefined) {
    if (!Array.isArray(v)) return false
    return rule.includes === '*' ? v.length > 0 : v.includes(rule.includes)
  }
  return v === rule.equals
}

/** Completeness score (rule 9): answered applicable sections ÷ applicable sections. Encourages, never required. */
export function completenessScore(applicable: string[], answered: string[]): number {
  if (applicable.length === 0) return 100
  const done = applicable.filter((k) => answered.includes(k)).length
  return Math.round((done / applicable.length) * 100)
}
