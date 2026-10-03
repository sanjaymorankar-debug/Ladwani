'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, MapPin, GraduationCap, Heart, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import EducationManager from '@/components/profile/EducationManager'
import EmploymentManager from '@/components/profile/EmploymentManager'
import BusinessManager from '@/components/profile/BusinessManager'
import SkillsManager from '@/components/profile/SkillsManager'
import AddressesManager from '@/components/profile/AddressesManager'
import SpouseLink from '@/components/profile/SpouseLink'
import PhotoManager from '@/components/profile/PhotoManager'
import LocationPicker from '@/components/profile/LocationPicker'
import ToggleSwitch from '@/components/ui/ToggleSwitch'
import RadioGroup from '@/components/ui/RadioGroup'
import Reveal from '@/components/ui/Reveal'
import { calculateAge } from '@/lib/utils'
import {
  EDUCATION_LEVELS, INCOME_RANGES, EARNING_TYPES, JOB_SECTORS, EARNING_TYPE_FIELDS, TOGGLE_DEPENDENTS,
  UNMARRIED_FLOW_FIELDS, BOOLEAN_FIELDS, profileDetailsToForm, addressToForm, validateProfileDetails,
  validateAddress, validateMobile, type ToggleField,
} from '@/lib/profile-details'

const OTHER_MARITAL_STATUSES = [
  { value: 'WIDOWED', label: 'Widowed' },
  { value: 'DIVORCED', label: 'Divorced' },
  { value: 'SEPARATED', label: 'Separated' },
  { value: 'NOT_STATED', label: 'Not stated' },
]

const text = z.string()
const detailsSchema = z.object({
  educationLevel: text, educationOther: text, educationStream: text, educationInstitution: text,
  annualIncomeRange: text,
  isEarning: z.boolean(), isPursuingEducation: z.boolean(),
  currentCourse: text, currentInstitution: text, expectedCompletionYear: text,
  earningType: text, companyName: text, designation: text, jobSector: text, businessName: text, businessType: text,
  readyForMarriage: z.boolean(), lookingForMarriage: z.boolean(),
  marriageHeightCm: text, motherTongue: text, nativePlace: text, partnerExpectations: text,
})
const addressSchema = z.object({
  line1: text, line2: text, city: text, taluka: text, district: text, state: text, pincode: text, country: text,
  latitude: z.number().nullable(), longitude: z.number().nullable(),
})

// `savedMobile` is the number already on record: it is only format-checked
// when changed, so older records with a differently-formatted number still save.
const makeSchema = (savedMobile: string) => z.object({
  firstName: z.string().trim().min(2, 'Full name is required (first name of at least 2 characters)'),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'NOT_STATED']),
  dateOfBirth: z.string().optional(),
  bloodGroup: z.string().optional(),
  heightCm: z.string().optional(),
  weightKg: z.string().optional(),
  bodyType: z.string().optional(),
  physicalDisability: z.string().optional(),
  mobilePrimary: z.string().optional(),
  email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
  maritalStatus: z.enum(['UNMARRIED', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED', 'NOT_STATED'], {
    errorMap: () => ({ message: 'Marital status is required' }),
  }),
  employmentStatus: z.string().optional(),
  occupationCategory: z.string().optional(),
  biography: z.string().optional(),
  nationality: z.string().optional(),
  languages: z.string().optional(), // comma-separated in the form, sent as a list
  details: detailsSchema,
  address: addressSchema,
}).superRefine((v, ctx) => {
  if (v.dateOfBirth && new Date(v.dateOfBirth) > new Date()) {
    ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Date of birth cannot be in the future' })
  }
  if ((v.mobilePrimary ?? '') !== savedMobile) {
    const err = validateMobile(v.mobilePrimary)
    if (err) ctx.addIssue({ code: 'custom', path: ['mobilePrimary'], message: err })
  }
  for (const e of validateProfileDetails(v.details, v.maritalStatus)) {
    ctx.addIssue({ code: 'custom', path: ['details', e.field], message: e.message })
  }
  for (const e of validateAddress(v.address)) {
    ctx.addIssue({ code: 'custom', path: ['address', e.field], message: e.message })
  }
})

type FormData = z.infer<ReturnType<typeof makeSchema>>
type DetailsField = keyof FormData['details']

const Req = () => <span className="text-red-500" aria-hidden="true"> *</span>

export default function EditMemberPage() {
  const router = useRouter()
  const params = useParams()
  const memberId = params.id as string
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [currentMaritalStatus, setCurrentMaritalStatus] = useState<string | null>(null)
  const [savedMobile, setSavedMobile] = useState('')
  const [addressChangePending, setAddressChangePending] = useState(false)
  // Which optional physical fields the community collects (section 16). Shown
  // by default until the config arrives so the form never flashes empty.
  const [physical, setPhysical] = useState<Record<string, boolean>>({
    heightCm: true, weightKg: true, bodyType: true, bloodGroup: true, physicalDisability: true,
  })
  useEffect(() => {
    fetch('/api/settings/physical-fields').then((r) => (r.ok ? r.json() : null)).then((d) => d && setPhysical(d.config)).catch(() => {})
  }, [])

  const schema = useMemo(() => makeSchema(savedMobile), [savedMobile])
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // `isCurrent` lets a superseded load bail out instead of resetting the form
  // over whatever the user has typed since.
  const fetchMember = (isCurrent: () => boolean = () => true) =>
    Promise.all([
      fetch(`/api/members/${memberId}`).then((r) => r.json()),
      // Older records simply have no details row / current address yet;
      // those load as empty fields.
      fetch(`/api/members/${memberId}/profile-details`).then((r) => (r.ok ? r.json() : {})) as Promise<any>,
    ])
      .then(([data, extra]) => {
        if (!isCurrent()) return
        setCurrentMaritalStatus(data.maritalStatus)
        setSavedMobile(data.mobilePrimary ?? '')
        setAddressChangePending(!!extra.addressChangePending)
        reset({
          firstName: data.firstName,
          middleName: data.middleName ?? '',
          lastName: data.lastName ?? '',
          gender: data.gender,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : '',
          bloodGroup: data.bloodGroup ?? '',
          heightCm: data.heightCm?.toString() ?? '',
          weightKg: data.weightKg?.toString() ?? '',
          bodyType: data.bodyType ?? '',
          physicalDisability: data.physicalDisability ?? '',
          mobilePrimary: data.mobilePrimary ?? '',
          email: data.email ?? '',
          maritalStatus: data.maritalStatus,
          employmentStatus: data.employmentStatus ?? '',
          occupationCategory: data.occupationCategory ?? '',
          biography: data.biography ?? '',
          nationality: data.nationality ?? 'Indian',
          languages: Array.isArray(data.languages) ? data.languages.join(', ') : '',
          details: profileDetailsToForm(extra.details),
          address: addressToForm(extra.currentAddress),
        })
        setIsFetching(false)
      })
      .catch(() => setIsFetching(false))

  useEffect(() => {
    let current = true
    fetchMember(() => current)
    return () => { current = false }
  }, [memberId])

  const maritalStatus = watch('maritalStatus')
  const d = watch('details') ?? profileDetailsToForm(null)
  const address = watch('address') ?? addressToForm(null)
  const age = calculateAge(watch('dateOfBirth') || null)
  const heightCm = watch('heightCm')

  const setDetail = (field: DetailsField, value: string | boolean) =>
    setValue(`details.${field}`, value as never, { shouldDirty: true })

  // Clearing is the rule for every dependent field: switching its parent off
  // (or leaving Unmarried) wipes it, so nothing hidden is ever saved.
  const clearDetails = (fields: readonly string[]) =>
    fields.forEach((f) => setDetail(f as DetailsField, BOOLEAN_FIELDS.includes(f) ? false : ''))

  const setToggle = (field: ToggleField, on: boolean) => {
    setDetail(field, on)
    if (!on) clearDetails(TOGGLE_DEPENDENTS[field])
    // Handy default: the height already on the profile.
    if (field === 'lookingForMarriage' && on && !d.marriageHeightCm && heightCm) setDetail('marriageHeightCm', heightCm)
  }

  const setEarningType = (type: string) => {
    setDetail('earningType', type)
    for (const [t, fields] of Object.entries(EARNING_TYPE_FIELDS)) if (t !== type) clearDetails(fields)
  }

  const setMaritalStatus = (status: string) => {
    setValue('maritalStatus', status as FormData['maritalStatus'], { shouldDirty: true, shouldValidate: true })
    if (status !== 'UNMARRIED') clearDetails(UNMARRIED_FLOW_FIELDS)
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const { details, address: currentAddress, ...rest } = data
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rest,
          languages: (data.languages ?? '').split(',').map((l) => l.trim()).filter(Boolean),
          profileDetails: details,
          currentAddress,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Update failed')
      if (json.addressStatus === 'pending') {
        toast('Profile saved. Your address change has been sent for review.', { icon: '🕓' })
      } else if (json.addressStatus === 'already_pending') {
        toast('Profile saved. An earlier address change is still awaiting review, so the new address was not submitted.', { icon: '🕓' })
      } else {
        toast.success('Profile updated successfully!')
      }
      router.push(`/members/${memberId}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Scroll to the first problem — on mobile it's often off-screen, inside a section.
  const onInvalid = () => {
    toast.error('Please fix the highlighted fields')
    requestAnimationFrame(() => document.querySelector('.form-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  if (isFetching) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
    </div>
  )

  const de = errors.details
  const ae = errors.address
  const isUnmarried = maritalStatus === 'UNMARRIED'
  const isOtherStatus = !['UNMARRIED', 'MARRIED'].includes(maritalStatus)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href={`/members/${memberId}`} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900">Edit Profile</h1>
      </div>
      <p className="text-xs text-gray-500 mb-6 ml-1">Fields marked <span className="text-red-500">*</span> are required.</p>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Personal Information</h3>

          <div>
            <span className="form-label">Marital Status<Req /></span>
            <RadioGroup
              name="maritalStatus"
              ariaLabel="Marital status"
              value={isOtherStatus ? 'OTHER' : maritalStatus}
              onChange={(v) => setMaritalStatus(v === 'OTHER' ? (isOtherStatus ? maritalStatus : 'NOT_STATED') : v)}
              options={[
                { value: 'UNMARRIED', label: 'Unmarried' },
                {
                  value: 'MARRIED', label: 'Married',
                  hint: currentMaritalStatus !== 'MARRIED' ? 'Use Link Spouse below' : undefined,
                },
                { value: 'OTHER', label: 'Other status' },
              ]}
              // Marrying links two records, so it goes through the spouse flow.
              disabledValues={currentMaritalStatus !== 'MARRIED' ? ['MARRIED'] : []}
            />
            <Reveal open={isOtherStatus}>
              <div className="pt-3">
                <label className="form-label" htmlFor="otherMaritalStatus">Which status?</label>
                <select id="otherMaritalStatus" value={isOtherStatus ? maritalStatus : 'NOT_STATED'}
                  onChange={(e) => setMaritalStatus(e.target.value)} className="form-input">
                  {OTHER_MARITAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </Reveal>
            {errors.maritalStatus && <p className="form-error">{errors.maritalStatus.message}</p>}
          </div>
          {currentMaritalStatus !== 'MARRIED' && (
            <SpouseLink memberId={memberId} onDone={() => fetchMember()} />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="form-label">First Name<Req /></label>
              <input {...register('firstName')} className="form-input" autoComplete="given-name" />
              {errors.firstName && <p className="form-error">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="form-label">Middle Name</label>
              <input {...register('middleName')} className="form-input" autoComplete="additional-name" />
            </div>
            <div>
              <label className="form-label">Last Name</label>
              <input {...register('lastName')} className="form-input" autoComplete="family-name" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Gender</label>
              <select {...register('gender')} className="form-input">
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="NOT_STATED">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="form-label">
                Date of Birth
                {age !== null && age >= 0 && <span className="ml-2 text-xs font-normal text-gray-500">Age: {age} years</span>}
              </label>
              <input {...register('dateOfBirth')} type="date" className="form-input"
                max={new Date().toISOString().split('T')[0]} />
              {errors.dateOfBirth && <p className="form-error">{errors.dateOfBirth.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {physical.bloodGroup && (
            <div>
              <label className="form-label">Blood Group</label>
              <select {...register('bloodGroup')} className="form-input">
                <option value="">Not known</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            )}
            <div>
              <label className="form-label">Nationality</label>
              <input {...register('nationality')} className="form-input" placeholder="Indian" />
            </div>
          </div>
          <div>
            <label className="form-label">Languages spoken</label>
            <input {...register('languages')} className="form-input" placeholder="Marathi, Hindi, English" />
          </div>
          <div>
            <label className="form-label">Biography / About</label>
            <textarea {...register('biography')} className="form-input min-h-[100px]"
              placeholder="Brief introduction about yourself..." />
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Physical Details <span className="text-xs text-gray-400 font-normal">(optional)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {physical.heightCm && (
            <div>
              <label className="form-label">Height (cm)</label>
              <input {...register('heightCm')} type="number" inputMode="numeric" className="form-input" placeholder="170" />
            </div>
            )}
            {physical.weightKg && (
            <div>
              <label className="form-label">Weight (kg)</label>
              <input {...register('weightKg')} type="number" inputMode="numeric" className="form-input" placeholder="65" />
            </div>
            )}
            {physical.bodyType && (
            <div>
              <label className="form-label">Body Type</label>
              <input {...register('bodyType')} className="form-input" placeholder="e.g. Athletic, Average" />
            </div>
            )}
            {physical.physicalDisability && (
            <div>
              <label className="form-label">Physical Disability</label>
              <input {...register('physicalDisability')} className="form-input" placeholder="Leave blank if none" />
            </div>
            )}
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Contact Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Mobile Number</label>
              <input {...register('mobilePrimary')} type="tel" inputMode="tel" autoComplete="tel-national"
                className="form-input" placeholder="9876543210" />
              {errors.mobilePrimary && <p className="form-error">{errors.mobilePrimary.message}</p>}
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input {...register('email')} type="email" autoComplete="email" className="form-input" />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-saffron-600" /> Current Address &amp; Location
          </h3>
          {addressChangePending && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2 flex items-start gap-1.5">
              <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              An address change is awaiting review. Further changes can be submitted once it is decided.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="form-label">House / Street</label>
              <input {...register('address.line1')} className="form-input" autoComplete="address-line1" placeholder="Flat 4, Shivaji Road" />
              {ae?.line1 && <p className="form-error">{ae.line1.message}</p>}
            </div>
            <div>
              <label className="form-label">Area / Locality</label>
              <input {...register('address.line2')} className="form-input" autoComplete="address-line2" placeholder="Kothrud" />
            </div>
            <div>
              <label className="form-label">City / Village</label>
              <input {...register('address.city')} className="form-input" autoComplete="address-level2" placeholder="Pune" />
            </div>
            <div>
              <label className="form-label">Taluka</label>
              <input {...register('address.taluka')} className="form-input" placeholder="Haveli" />
            </div>
            <div>
              <label className="form-label">District</label>
              <input {...register('address.district')} className="form-input" placeholder="Pune" />
            </div>
            <div>
              <label className="form-label">State</label>
              <input {...register('address.state')} className="form-input" autoComplete="address-level1" placeholder="Maharashtra" />
            </div>
            <div>
              <label className="form-label">PIN Code</label>
              <input {...register('address.pincode')} inputMode="numeric" maxLength={6} autoComplete="postal-code"
                className="form-input" placeholder="411038" />
              {ae?.pincode && <p className="form-error">{ae.pincode.message}</p>}
            </div>
            <div>
              <label className="form-label">Country</label>
              <input {...register('address.country')} className="form-input" autoComplete="country-name" placeholder="India" />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Location on map <span className="text-xs text-gray-400 font-normal">(optional)</span></p>
            <p className="text-xs text-gray-500 mb-2">Helps family find you. If you&apos;d rather not share location, just fill in the address above.</p>
            <LocationPicker
              latitude={address.latitude}
              longitude={address.longitude}
              onChange={(lat, lng) => {
                setValue('address.latitude', lat, { shouldDirty: true })
                setValue('address.longitude', lng, { shouldDirty: true })
              }}
              error={ae?.latitude?.message ?? ae?.longitude?.message}
            />
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-saffron-600" /> Education
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="form-label">Highest Education</label>
              <select {...register('details.educationLevel', {
                onChange: (e) => { if (e.target.value !== 'OTHER') setDetail('educationOther', '') },
              })} className="form-input">
                <option value="">Not specified</option>
                {EDUCATION_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              {de?.educationLevel && <p className="form-error">{de.educationLevel.message}</p>}
            </div>
          </div>
          <Reveal open={d.educationLevel === 'OTHER'}>
            <div>
              <label className="form-label">Please specify<Req /></label>
              <input {...register('details.educationOther')} className="form-input" placeholder="e.g. Vedic studies" />
              {de?.educationOther && <p className="form-error">{de.educationOther.message}</p>}
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Stream / Specialisation <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
              <input {...register('details.educationStream')} className="form-input" placeholder="e.g. Commerce, Mechanical" />
            </div>
            <div>
              <label className="form-label">Institution Name <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
              <input {...register('details.educationInstitution')} className="form-input" placeholder="College / University" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Employment &amp; Income</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Employment Status</label>
              <select {...register('employmentStatus')} className="form-input">
                <option value="">Not specified</option>
                {['EMPLOYED', 'SELF_EMPLOYED', 'BUSINESS', 'PROFESSIONAL', 'STUDENT', 'RETIRED', 'NOT_EARNING'].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Occupation Category</label>
              <input {...register('occupationCategory')} className="form-input" placeholder="IT, Healthcare, Business..." />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Annual Income <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
              <select {...register('details.annualIncomeRange')} className="form-input">
                <option value="">Not specified</option>
                {INCOME_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              {de?.annualIncomeRange && <p className="form-error">{de.annualIncomeRange.message}</p>}
            </div>
          </div>
        </div>

        {/* No gap left behind when collapsed. */}
        <Reveal open={isUnmarried} className={isUnmarried ? '' : '!mt-0'}>
          <div className="card space-y-2">
            <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
              <Heart className="w-4 h-4 text-saffron-600" /> Current Situation
            </h3>

            <ToggleSwitch label="Pursuing education" description="Currently studying"
              checked={d.isPursuingEducation} onCheckedChange={(on) => setToggle('isPursuingEducation', on)} />
            <Reveal open={d.isPursuingEducation}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-3 border-l-2 border-saffron-100 ml-1 mb-2">
                <div>
                  <label className="form-label">Current Course<Req /></label>
                  <input {...register('details.currentCourse')} className="form-input" placeholder="e.g. B.Com 2nd year" />
                  {de?.currentCourse && <p className="form-error">{de.currentCourse.message}</p>}
                </div>
                <div>
                  <label className="form-label">Institution</label>
                  <input {...register('details.currentInstitution')} className="form-input" placeholder="College / School" />
                </div>
                <div>
                  <label className="form-label">Expected Completion Year</label>
                  <input {...register('details.expectedCompletionYear')} type="number" inputMode="numeric"
                    className="form-input" placeholder={String(new Date().getFullYear() + 1)} />
                  {de?.expectedCompletionYear && <p className="form-error">{de.expectedCompletionYear.message}</p>}
                </div>
              </div>
            </Reveal>

            <div className="border-t border-gray-100" />
            <ToggleSwitch label="Earning" description="Has a job or runs a business"
              checked={d.isEarning} onCheckedChange={(on) => setToggle('isEarning', on)} />
            <Reveal open={d.isEarning}>
              <div className="space-y-3 pl-3 border-l-2 border-saffron-100 ml-1 mb-2">
                <div>
                  <span className="form-label">Type of Earning<Req /></span>
                  <RadioGroup name="earningType" ariaLabel="Type of earning" value={d.earningType}
                    onChange={setEarningType} options={EARNING_TYPES} />
                  {de?.earningType && <p className="form-error">{de.earningType.message}</p>}
                </div>

                <Reveal open={d.earningType === 'JOB'}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Company Name<Req /></label>
                      <input {...register('details.companyName')} className="form-input" />
                      {de?.companyName && <p className="form-error">{de.companyName.message}</p>}
                    </div>
                    <div>
                      <label className="form-label">Designation</label>
                      <input {...register('details.designation')} className="form-input" placeholder="e.g. Engineer" />
                    </div>
                    <div className="sm:col-span-2">
                      <span className="form-label">Sector</span>
                      <RadioGroup name="jobSector" ariaLabel="Sector" value={d.jobSector}
                        onChange={(v) => setDetail('jobSector', v)} options={JOB_SECTORS} />
                      {de?.jobSector && <p className="form-error">{de.jobSector.message}</p>}
                    </div>
                  </div>
                </Reveal>

                <Reveal open={d.earningType === 'BUSINESS'}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Business Name<Req /></label>
                      <input {...register('details.businessName')} className="form-input" />
                      {de?.businessName && <p className="form-error">{de.businessName.message}</p>}
                    </div>
                    <div>
                      <label className="form-label">Type of Business</label>
                      <input {...register('details.businessType')} className="form-input" placeholder="e.g. Retail, Manufacturing" />
                    </div>
                  </div>
                </Reveal>

                <div className="border-t border-gray-100" />
                <ToggleSwitch label="Ready for marriage"
                  checked={d.readyForMarriage} onCheckedChange={(on) => setToggle('readyForMarriage', on)} />
                <Reveal open={d.readyForMarriage}>
                  <div className="pl-3 border-l-2 border-saffron-100 ml-1">
                    <ToggleSwitch label="Looking for marriage" description="Share a few details for matchmaking"
                      checked={d.lookingForMarriage} onCheckedChange={(on) => setToggle('lookingForMarriage', on)} />
                    <Reveal open={d.lookingForMarriage}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                        <div>
                          <label className="form-label">Height (cm)</label>
                          <input {...register('details.marriageHeightCm')} type="number" inputMode="numeric"
                            className="form-input" placeholder="170" />
                          {de?.marriageHeightCm && <p className="form-error">{de.marriageHeightCm.message}</p>}
                        </div>
                        <div>
                          <label className="form-label">Mother Tongue</label>
                          <input {...register('details.motherTongue')} className="form-input" placeholder="e.g. Marathi" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="form-label">Native Place</label>
                          <input {...register('details.nativePlace')} className="form-input" placeholder="Village / town" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="form-label">Partner Expectations</label>
                          <textarea {...register('details.partnerExpectations')} maxLength={1000}
                            className="form-input min-h-[80px]" placeholder="A few lines about what you are looking for" />
                          {de?.partnerExpectations && <p className="form-error">{de.partnerExpectations.message}</p>}
                        </div>
                      </div>
                    </Reveal>
                  </div>
                </Reveal>
              </div>
            </Reveal>
          </div>
        </Reveal>

        <div className="flex gap-3">
          <Link href={`/members/${memberId}`} className="btn-secondary flex-1 py-3 text-center">Cancel</Link>
          <button type="submit" disabled={isLoading || !isDirty}
            className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-60">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* These sections save independently — no need to hit "Save Changes" above for them. */}
      <div className="space-y-6 mt-6">
        <PhotoManager memberId={memberId} />
        <AddressesManager memberId={memberId} types={['NATIVE']} />
        <EducationManager memberId={memberId} />
        <EmploymentManager memberId={memberId} />
        <BusinessManager memberId={memberId} />
        <SkillsManager memberId={memberId} />
      </div>
    </div>
  )
}
