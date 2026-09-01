'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import EducationManager from '@/components/profile/EducationManager'
import EmploymentManager from '@/components/profile/EmploymentManager'
import SkillsManager from '@/components/profile/SkillsManager'
import AddressesManager from '@/components/profile/AddressesManager'
import SpouseLink from '@/components/profile/SpouseLink'
import PhotoManager from '@/components/profile/PhotoManager'

const schema = z.object({
  firstName: z.string().min(2),
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
  email: z.string().email().optional().or(z.literal('')),
  maritalStatus: z.enum(['UNMARRIED', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED', 'NOT_STATED']),
  employmentStatus: z.string().optional(),
  occupationCategory: z.string().optional(),
  biography: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function EditMemberPage() {
  const router = useRouter()
  const params = useParams()
  const memberId = params.id as string
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [currentMaritalStatus, setCurrentMaritalStatus] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const fetchMember = () =>
    fetch(`/api/members/${memberId}`)
      .then((r) => r.json())
      .then((data) => {
        setCurrentMaritalStatus(data.maritalStatus)
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
        })
        setIsFetching(false)
      })
      .catch(() => setIsFetching(false))

  useEffect(() => { fetchMember() }, [memberId])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Update failed')
      toast.success('Profile updated successfully!')
      router.push(`/members/${memberId}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/members/${memberId}`} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900">Edit Profile</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Personal Information</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">First Name *</label>
              <input {...register('firstName')} className="form-input" />
              {errors.firstName && <p className="form-error">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="form-label">Middle Name</label>
              <input {...register('middleName')} className="form-input" />
            </div>
            <div>
              <label className="form-label">Last Name</label>
              <input {...register('lastName')} className="form-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <label className="form-label">Marital Status</label>
              <select {...register('maritalStatus')} className="form-input">
                <option value="UNMARRIED">Unmarried</option>
                <option value="MARRIED" disabled={currentMaritalStatus !== 'MARRIED'}>
                  Married{currentMaritalStatus !== 'MARRIED' ? ' (use Link Spouse below)' : ''}
                </option>
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
          {currentMaritalStatus !== 'MARRIED' && (
            <SpouseLink memberId={memberId} onDone={fetchMember} />
          )}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Height (cm)</label>
              <input {...register('heightCm')} type="number" className="form-input" placeholder="170" />
            </div>
            <div>
              <label className="form-label">Weight (kg)</label>
              <input {...register('weightKg')} type="number" className="form-input" placeholder="65" />
            </div>
            <div>
              <label className="form-label">Body Type</label>
              <input {...register('bodyType')} className="form-input" placeholder="e.g. Athletic, Average" />
            </div>
            <div>
              <label className="form-label">Physical Disability</label>
              <input {...register('physicalDisability')} className="form-input" placeholder="Leave blank if none" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Contact Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Mobile Number</label>
              <input {...register('mobilePrimary')} className="form-input" placeholder="9876543210" />
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input {...register('email')} type="email" className="form-input" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Employment Status</h3>
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
        <AddressesManager memberId={memberId} />
        <EducationManager memberId={memberId} />
        <EmploymentManager memberId={memberId} />
        <SkillsManager memberId={memberId} />
      </div>
    </div>
  )
}
