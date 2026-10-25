/**
 * Dropdown values for the Additional Details area (rule 11).
 *
 * These are the built-in defaults. An Admin can override any list from
 * /admin/config/options — rows in `option_masters` for a listKey replace the
 * defaults for that list (see getOptionLists in ./server.ts). Stored values
 * are the `value` codes, so relabelling an option never rewrites data.
 *
 * No list here carries an exact amount: money is always a band (rule 6).
 */
export interface Option {
  value: string
  label: string
}

const o = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }))

export const MONTHS: Option[] = o([
  ['1', 'January'], ['2', 'February'], ['3', 'March'], ['4', 'April'], ['5', 'May'], ['6', 'June'],
  ['7', 'July'], ['8', 'August'], ['9', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
])

export const DEFAULT_OPTIONS: Record<string, Option[]> = {
  INSURANCE_TYPE: o([['LIFE', 'Life'], ['HEALTH', 'Health'], ['VEHICLE', 'Vehicle'], ['HOME', 'Home'], ['CROP', 'Crop'], ['OTHER', 'Other']]),
  SUM_INSURED_BAND: o([
    ['UPTO_5L', 'Up to ₹5 lakh'], ['5L_10L', '₹5–10 lakh'], ['10L_25L', '₹10–25 lakh'],
    ['25L_50L', '₹25–50 lakh'], ['50L_1CR', '₹50 lakh–1 crore'], ['ABOVE_1CR', 'Above ₹1 crore'],
  ]),
  DOCTOR_SPECIALITY: o([
    ['GENERAL', 'General physician'], ['PAEDIATRICS', 'Paediatrician'], ['GYNAECOLOGY', 'Gynaecologist'],
    ['AYURVEDA', 'Ayurveda'], ['HOMEOPATHY', 'Homeopathy'], ['DENTAL', 'Dentist'], ['OTHER', 'Other'],
  ]),
  ADVISER_TYPE: o([
    ['CA', 'CA'], ['MF_DISTRIBUTOR', 'Mutual fund distributor'], ['REGISTERED_ADVISER', 'Registered adviser'],
    ['BANK_RM', 'Bank relationship manager'], ['OTHER', 'Other'],
  ]),
  VEHICLE_TYPE: o([['CAR', 'Car'], ['BIKE', 'Bike'], ['SCOOTER', 'Scooter'], ['OTHER', 'Other']]),
  FUEL_TYPE: o([['PETROL', 'Petrol'], ['DIESEL', 'Diesel'], ['CNG', 'CNG'], ['ELECTRIC', 'Electric'], ['HYBRID', 'Hybrid'], ['OTHER', 'Other']]),
  LOAN_TYPE: o([
    ['HOME', 'Home'], ['EDUCATION', 'Education'], ['VEHICLE', 'Vehicle'], ['PERSONAL', 'Personal'],
    ['BUSINESS', 'Business'], ['AGRICULTURE', 'Agriculture or crop'], ['GOLD', 'Gold'], ['OTHER', 'Other'],
  ]),
  LOAN_AMOUNT_BAND: o([
    ['UPTO_1L', 'Up to ₹1 lakh'], ['1L_5L', '₹1–5 lakh'], ['5L_10L', '₹5–10 lakh'], ['10L_25L', '₹10–25 lakh'],
    ['25L_50L', '₹25–50 lakh'], ['ABOVE_50L', 'Above ₹50 lakh'],
  ]),
  BANKING_NEED: o([['NEW_ACCOUNT', 'New account'], ['FIXED_DEPOSIT', 'Fixed deposit'], ['CREDIT_CARD', 'Credit card'], ['LOCKER', 'Locker'], ['OTHER', 'Other']]),
  LAND_UNIT: o([['ACRE', 'Acre'], ['GUNTHA', 'Guntha'], ['HECTARE', 'Hectare']]),
  FARM_OWNERSHIP: o([['OWN', 'Own'], ['JOINT_FAMILY', 'Joint family'], ['LEASED', 'Leased']]),
  HOUSE_OWNERSHIP: o([['OWN', 'Own'], ['RENTED', 'Rented'], ['FAMILY_OWNED', 'Family-owned'], ['COMPANY_PROVIDED', 'Company-provided']]),
  HOUSE_TYPE: o([['FLAT', 'Flat'], ['BUNGALOW', 'Bungalow'], ['ROW_HOUSE', 'Row house'], ['FARM_HOUSE', 'Farm house'], ['OTHER', 'Other']]),
  MARKS_TYPE: o([['PERCENTAGE', 'Percentage'], ['CGPA', 'CGPA'], ['GRADE', 'Grade']]),
  MARKS_SCALE: o([['100', 'Out of 100'], ['10', 'Out of 10'], ['4', 'Out of 4']]),
  EDU_SUPPORT_TYPE: o([
    ['FEES', 'Fees'], ['SCHOLARSHIP', 'Scholarship'], ['BOOKS', 'Books'], ['COACHING', 'Coaching'],
    ['CAREER_GUIDANCE', 'Career guidance'], ['HOSTEL', 'Hostel'], ['OTHER', 'Other'],
  ]),
  SUPPORT_AMOUNT_BAND: o([
    ['UPTO_10K', 'Up to ₹10,000'], ['10K_50K', '₹10,000–50,000'], ['50K_1L', '₹50,000–1 lakh'],
    ['1L_5L', '₹1–5 lakh'], ['ABOVE_5L', 'Above ₹5 lakh'],
  ]),
  SPORT_LEVEL: o([['SCHOOL', 'School'], ['DISTRICT', 'District'], ['STATE', 'State'], ['NATIONAL', 'National'], ['INTERNATIONAL', 'International']]),
  MEDAL: o([['GOLD', 'Gold'], ['SILVER', 'Silver'], ['BRONZE', 'Bronze'], ['PARTICIPATION', 'Participation']]),
  SPORT_SUPPORT_TYPE: o([
    ['COACHING_FEES', 'Coaching fees'], ['EQUIPMENT', 'Equipment'], ['TRAVEL', 'Travel'], ['DIET', 'Diet'],
    ['SPONSORSHIP', 'Sponsorship'], ['OTHER', 'Other'],
  ]),
  HOBBY_LEVEL: o([['BEGINNER', 'Beginner'], ['REGULAR', 'Regular'], ['EXPERT', 'Expert']]),
  HOBBY_SUPPORT_TYPE: o([
    ['TRAINING', 'Training'], ['EQUIPMENT', 'Equipment'], ['PRACTICE_GROUP', 'A group to practise with'],
    ['STAGE', 'A stage to perform'], ['FUNDS', 'Funds'], ['OTHER', 'Other'],
  ]),
  CAREER_LOOKING_FOR: o([
    ['JOB', 'Job'], ['JOB_CHANGE', 'Job change'], ['INTERNSHIP', 'Internship'], ['BUSINESS_PARTNER', 'Business partner'],
    ['CUSTOMERS', 'Customers for my business'], ['NOTHING', 'Nothing now'],
  ]),
  EXPERIENCE_BAND: o([['FRESHER', 'Fresher'], ['1_3', '1–3 years'], ['3_7', '3–7 years'], ['7_15', '7–15 years'], ['15_PLUS', '15+ years']]),
  CAREER_CAN_OFFER: o([['JOB_REFERRAL', 'Job referral'], ['INTERNSHIP', 'Internship'], ['MENTORING', 'Mentoring'], ['BUSINESS_ADVICE', 'Business advice']]),
  CAREER_SUPPORT: o([['RESUME', 'Resume help'], ['INTERVIEW', 'Interview preparation'], ['SKILL_TRAINING', 'Skill training'], ['CAREER_GUIDANCE', 'Career guidance']]),
  BUSINESS_CATEGORY: o([
    ['RETAIL', 'Retail / shop'], ['MANUFACTURING', 'Manufacturing'], ['SERVICES', 'Services'], ['FOOD', 'Food & catering'],
    ['AGRI', 'Agriculture'], ['PROFESSIONAL', 'Professional practice'], ['IT', 'IT & digital'], ['TRADING', 'Trading'], ['OTHER', 'Other'],
  ]),
  BUSINESS_SUPPORT: o([
    ['CUSTOMERS', 'Customers'], ['FUNDING', 'Funding'], ['MENTORING', 'Mentoring'],
    ['GOVT_SCHEME', 'Government scheme guidance'], ['DIGITAL_PRESENCE', 'Digital presence'],
  ]),
  TEACH_MODE: o([['ONLINE', 'Online'], ['IN_PERSON', 'In person'], ['BOTH', 'Both']]),
  TEACH_FEE: o([['FREE', 'Free'], ['PAID', 'Paid'], ['EITHER', 'Either']]),
  GUIDANCE_FIELD: o([
    ['LEGAL', 'Legal'], ['TAX', 'Tax'], ['MEDICAL', 'Medical'], ['ENGINEERING', 'Engineering'],
    ['EDUCATION', 'Education'], ['AGRICULTURE', 'Agriculture'], ['OTHER', 'Other'],
  ]),
  HOURS_BAND: o([['UPTO_4', 'Up to 4 hours'], ['4_10', '4–10 hours'], ['10_20', '10–20 hours'], ['20_PLUS', '20+ hours']]),
  WELLNESS_ACTIVITY: o([['WALKING', 'Walking'], ['YOGA', 'Yoga'], ['GYM', 'Gym'], ['SPORTS', 'Sports'], ['NONE', 'None']]),
  WELLNESS_WANT: o([
    ['FITNESS_GROUP', 'Fitness group'], ['YOGA_GROUP', 'Yoga group'], ['DIET_GUIDANCE', 'Diet guidance'],
    ['CHECKUP_CAMP_INFO', 'Health check-up camp information'],
  ]),
  SENIOR_LIVES: o([['WITH_FAMILY', 'With family'], ['WITH_SPOUSE', 'With spouse only'], ['ALONE', 'Alone']]),
  SENIOR_NEED: o([
    ['COMPANIONSHIP', 'Companionship visits'], ['DIGITAL_HELP', 'Help with digital tasks (phone, banking apps, online forms)'],
    ['TRAVEL_GROUP', 'Travel or pilgrimage group'], ['PENSION_GUIDANCE', 'Pension or scheme guidance'],
    ['PHONE_CHECKIN', 'Regular phone check-in'],
  ]),
  STUDENT_NEED: o([
    ['TUITION', 'Tuition'], ['COMPETITIVE_EXAM', 'Competitive exam guidance'], ['CAREER_COUNSELLING', 'Career counselling'],
    ['SCHOLARSHIP_INFO', 'Scholarship information'], ['HOSTEL', 'Hostel or stay in another city'], ['MENTOR', 'Mentor in my field'],
  ]),
  WOMEN_INTEREST: o([
    ['SHG', 'Self-help group'], ['HOME_BUSINESS', 'Home-based business'], ['SKILL_TRAINING', 'Skill training'],
    ['RETURN_TO_WORK', 'Returning to work after a break'],
  ]),
  WOMEN_NEED: o([['TRAINING', 'Training'], ['FUNDING_GUIDANCE', 'Funding guidance'], ['MARKET', 'Market for products'], ['MENTORING', 'Mentoring']]),
  GOV_DOC_NEED: o([
    ['CASTE_CERT', 'Caste certificate'], ['INCOME_CERT', 'Income certificate'], ['DOMICILE_CERT', 'Domicile certificate'],
    ['RATION_CARD', 'Ration card'], ['PASSPORT', 'Passport'], ['PAN', 'PAN'], ['SENIOR_CARD', 'Senior citizen card'],
    ['HEALTH_CARD', 'Ayushman / health card'], ['FARMER_SCHEMES', 'Farmer schemes'], ['SCHOLARSHIP_FORMS', 'Scholarship forms'],
    ['PENSION', 'Pension'],
  ]),
  HOUSING_LOOKING_TO: o([['BUY', 'Buy'], ['SELL', 'Sell'], ['RENT_OUT', 'Rent out'], ['TAKE_ON_RENT', 'Take on rent']]),
  BUDGET_BAND: o([
    ['UPTO_10K_PM', 'Rent up to ₹10,000/month'], ['10K_25K_PM', 'Rent ₹10,000–25,000/month'], ['ABOVE_25K_PM', 'Rent above ₹25,000/month'],
    ['UPTO_25L', 'Up to ₹25 lakh'], ['25L_50L', '₹25–50 lakh'], ['50L_1CR', '₹50 lakh–1 crore'], ['ABOVE_1CR', 'Above ₹1 crore'],
  ]),
  TRAVEL_INTEREST: o([
    ['GROUP_TOURS', 'Group tours'], ['PILGRIMAGE', 'Pilgrimage (yatra)'], ['TREKKING', 'Trekking groups'],
    ['GET_TOGETHERS', 'Community get-togethers'], ['FESTIVALS', 'Festival celebrations'], ['TOURNAMENTS', 'Sports tournaments'],
  ]),
  CULTURE_INTEREST: o([
    ['COMMUNITY_HISTORY', 'Community history'], ['BHAJAN_MANDAL', 'Bhajan mandal'], ['FESTIVAL_COMMITTEE', 'Festival committees'],
    ['YOUTH_WING', 'Youth wing'], ['WOMENS_WING', "Women's wing"], ['SENIOR_CLUB', "Senior citizens' club"],
  ]),
  MARRIAGE_SUPPORT: o([
    ['FIND_MATCH', 'Finding a match'], ['HOROSCOPE', 'Horoscope matching'], ['WEDDING_CONTACTS', 'Wedding planning contacts'],
    ['COMMUNITY_HALL', 'Community hall'],
  ]),
  EMERGENCY_HELP: o([['VEHICLE', 'Vehicle'], ['BLOOD', 'Blood'], ['STAY', 'Stay'], ['MEDICAL_KNOWLEDGE', 'Medical knowledge']]),
  BLOOD_GROUP: o([['A+', 'A+'], ['A-', 'A-'], ['B+', 'B+'], ['B-', 'B-'], ['AB+', 'AB+'], ['AB-', 'AB-'], ['O+', 'O+'], ['O-', 'O-']]),
  MONTH: MONTHS,
}

/** Lists an Admin may edit. MONTH is fixed. */
export const EDITABLE_LIST_KEYS = Object.keys(DEFAULT_OPTIONS).filter((k) => k !== 'MONTH' && k !== 'BLOOD_GROUP')

export type OptionLists = Record<string, Option[]>

export function optionLabel(lists: OptionLists, listKey: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const found = (lists[listKey] ?? DEFAULT_OPTIONS[listKey] ?? []).find((x) => x.value === String(value))
  return found?.label ?? String(value)
}
