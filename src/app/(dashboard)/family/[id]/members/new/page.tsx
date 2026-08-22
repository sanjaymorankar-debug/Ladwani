'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, User, MapPin, GraduationCap, Briefcase, Users } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const schema = z.object({
  firstName: z.string().min(2, 'Required'),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'NOT_STATED']),
  dateOfBirth: z.string().optional(),
  dateOfBirthApprox: z.boolean().default(false),
  bloodGroup: z.string().optional(),
  mobilePrimary: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  currentCity: z.string().optional(),
  currentState: z.string().optional(),
  currentCountry: z.string().default('India'),
  nativeVillage: z.string().optional(),
  nativeDistrict: z.string().optional(),
  nativeState: z.string().optional(),
  maritalStatus: z.enum(['UNMARRIED', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED', 'NOT_STATED']).default('UNMARRIED'),
  employmentStatus: z.string().optional(),
  occupationCategory: z.string().optional(),
  biography: z.string().optional(),
  relationshipTypeCode: z.string().min(1, 'Please select relationship to existing member'),
  relatedToMemberId: z.string().optional(),
  educationLevel: z.string().optional(),
  educationQualification: z.string().optional(),
  educationInstitution: z.string().optional(),
  educationYear: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const STEPS = ['Personal', 'Contact & Address', 'Relationship', 'Education & Work']

export default function AddMemberPage() {
  const router = useRouter()
  const params = useParams()
  const familyId = params.id as string

  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [relTypes, setRelTypes] = useState<any[]>([])
  const [familyMembers, setFamilyMembers] = useState<any[]>([])

  const { register, handleSubmit, watch, formState: { errors }, trigger } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { gender: 'NOT_STATED', maritalStatus: 'UNMARRIED', currentCountry: 'India' },
  })

  useEffect(() => {
    Promise.all([
      fetch('/ladwani/api/relationship-types').then((r) => r.json()),
      fetch(`/ladwani/api/families/${familyId}/members`).then((r) => r.json()),
    ]).then(([rels, members]) => {
      setRelTypes(rels?.types ?? [])
      setFamilyMembers(members?.members ?? [])
    })
  }, [familyId])

  const nextStep = async () => {
    const fields: any[] = [
      ['firstName', 'gender'],
      ['currentCity', 'currentState', 'mobilePrimary'],
      ['relationshipTypeCode'],
      [],
    ]
    const valid = await trigger(fields[step] as any)
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/ladwani/api/families/${familyId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to add member')
      toast.success('Member added successfully!')
      router.push(`/family/${familyId}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const genderWatch = watch('gender')

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/family/${familyId}`} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add Family Member</h1>
          <p className="text-gray-500 text-sm">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-saffron-500' : 'bg-gray-200'}`} />
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card space-y-4">

          {/* Step 0 — Personal Info */}
          {step === 0 && (
            <>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4 text-saffron-600" /> Personal Information
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">First Name *</label>
                  <input {...register('firstName')} className="form-input" placeholder="Ramesh" />
                  {errors.firstName && <p className="form-error">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="form-label">Middle Name</label>
                  <input {...register('middleName')} className="form-input" placeholder="Kumar" />
                </div>
                <div>
                  <label className="form-label">Last Name</label>
                  <input {...register('lastName')} className="form-input" placeholder="Ladwani" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Gender *</label>
                  <select {...register('gender')} className="form-input">
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="NOT_STATED">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Marital Status</label>
                  <select {...register('maritalStatus')} className="form-input">
                    <option value="UNMARRIED">Unmarried</option>
                    <option value="MARRIED">Married</option>
                    <option value="WIDOWED">Widowed</option>
                    <option value="DIVORCED">Divorced</option>
                    <option value="SEPARATED">Separated</option>
                    <option value="NOT_STATED">Not stated</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Date of Birth</label>
                  <input {...register('dateOfBirth')} type="date" className="form-input"
                    max={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="form-label">Blood Group</label>
                  <select {...register('bloodGroup')} className="form-input">
                    <option value="">Not known</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Biography / About</label>
                <textarea {...register('biography')} className="form-input min-h-[80px]"
                  placeholder="Brief introduction about this person..." />
              </div>
            </>
          )}

          {/* Step 1 — Contact & Address */}
          {step === 1 && (
            <>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-saffron-600" /> Contact & Address
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Mobile Number</label>
                  <input {...register('mobilePrimary')} className="form-input" placeholder="9876543210" />
                </div>
                <div>
                  <label className="form-label">Email Address</label>
                  <input {...register('email')} type="email" className="form-input" placeholder="optional" />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Current Residence</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="form-label">City</label>
                    <input {...register('currentCity')} className="form-input" placeholder="Pune" />
                  </div>
                  <div>
                    <label className="form-label">State</label>
                    <input {...register('currentState')} className="form-input" placeholder="Maharashtra" />
                  </div>
                  <div>
                    <label className="form-label">Country</label>
                    <input {...register('currentCountry')} className="form-input" placeholder="India" />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Native / Original Place</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="form-label">Village</label>
                    <input {...register('nativeVillage')} className="form-input" placeholder="Village name" />
                  </div>
                  <div>
                    <label className="form-label">District</label>
                    <input {...register('nativeDistrict')} className="form-input" placeholder="District" />
                  </div>
                  <div>
                    <label className="form-label">State</label>
                    <input {...register('nativeState')} className="form-input" placeholder="State" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 2 — Relationship */}
          {step === 2 && (
            <>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-saffron-600" /> Family Relationship
              </h2>
              <div>
                <label className="form-label">Relationship to (select existing member)</label>
                <select {...register('relatedToMemberId')} className="form-input">
                  <option value="">No existing member to link</option>
                  {familyMembers.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName ?? ''} ({m.maritalStatus})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">This new member is the... *</label>
                <select {...register('relationshipTypeCode')} className="form-input">
                  <option value="">Select relationship</option>
                  {relTypes.map((rt: any) => (
                    <option key={rt.code} value={rt.code}>{rt.label}</option>
                  ))}
                </select>
                {errors.relationshipTypeCode && (
                  <p className="form-error">{errors.relationshipTypeCode.message}</p>
                )}
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800">
                <strong>Note:</strong> The relationship will be created bidirectionally. For example,
                if this person is the Son of Ramesh Ladwani, Ramesh will automatically be recorded as
                Father of this person.
              </div>
            </>
          )}

          {/* Step 3 — Education & Employment */}
          {step === 3 && (
            <>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-saffron-600" /> Education
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Highest Education Level</label>
                  <select {...register('educationLevel')} className="form-input">
                    <option value="">Not specified</option>
                    {['SCHOOL', 'DIPLOMA', 'ITI', 'UNDERGRADUATE', 'POSTGRADUATE', 'DOCTORATE', 'PROFESSIONAL'].map((l) => (
                      <option key={l} value={l}>{l.charAt(0) + l.slice(1).toLowerCase().replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Qualification / Degree</label>
                  <input {...register('educationQualification')} className="form-input" placeholder="B.E. Computer Engineering" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Institution</label>
                  <input {...register('educationInstitution')} className="form-input" placeholder="University / College name" />
                </div>
                <div>
                  <label className="form-label">Year Completed</label>
                  <input {...register('educationYear')} type="number" className="form-input"
                    placeholder="2018" min="1950" max={new Date().getFullYear()} />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <Briefcase className="w-4 h-4 text-saffron-600" /> Employment
                </h2>
                <div className="grid grid-cols-2 gap-3">
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
                </div>
              </div>
            </>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-4">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary flex-1 py-3">
              ← Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={nextStep} className="btn-primary flex-1 py-3">
              Next →
            </button>
          ) : (
            <button type="submit" disabled={isLoading}
              className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-70">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isLoading ? 'Adding Member...' : 'Add to Family'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
