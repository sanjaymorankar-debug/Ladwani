'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, UserCheck, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { claimInvitationSchema } from '@/lib/validators'

type ClaimInput = { password: string; confirmPassword: string; mobile?: string }

interface InvitationInfo {
  member: { firstName: string; lastInitial: string | null; familyName: string | null }
  email: string | null
}

export default function ClaimProfilePage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<ClaimInput>({
    resolver: zodResolver(claimInvitationSchema),
  })

  useEffect(() => {
    fetch(`/api/invitations/${params.token}`)
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.message ?? 'This invitation link is not valid.')
        setInfo(json)
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [params.token])

  const onSubmit = async (data: ClaimInput) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/invitations/${params.token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Could not complete your registration.')
      toast.success('Your account is ready — please sign in.')
      router.push('/login')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-saffron-500" />
      </div>
    )
  }

  if (loadError || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center py-10">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">This link can&apos;t be used</h1>
          <p className="text-gray-500 text-sm mb-6">{loadError}</p>
          <Link href="/login" className="btn-primary inline-flex">Go to sign in</Link>
        </div>
      </div>
    )
  }

  const name = [info.member.firstName, info.member.lastInitial].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-3">
            म
          </div>
          <h1 className="text-xl font-bold text-gray-900">Mi Ladwani</h1>
          <p className="text-gray-500 text-sm">Ladwani Samaj community platform</p>
        </div>

        <div className="card">
          <div className="flex items-start gap-3 pb-4 mb-4 border-b border-gray-100">
            <UserCheck className="w-5 h-5 text-saffron-600 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-gray-900">Claim your profile</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                A profile for <strong className="text-gray-700">{name}</strong>
                {info.member.familyName ? ` of the ${info.member.familyName} family` : ''} has
                already been created for you. Set a password to take it over.
              </p>
            </div>
          </div>

          {info.email && (
            <div className="mb-4">
              <label className="form-label">Your email</label>
              <input value={info.email} disabled className="form-input bg-gray-50 text-gray-500" />
              <p className="text-xs text-gray-400 mt-1">This is the address your invitation was sent to.</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="form-label">Mobile number (optional)</label>
              <input {...register('mobile')} className="form-input" placeholder="10-digit mobile number" />
              {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile.message}</p>}
            </div>

            <div>
              <label className="form-label">Choose a password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  className="form-input pr-10"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              <p className="text-xs text-gray-400 mt-1">
                At least 8 characters, with one capital letter and one number.
              </p>
            </div>

            <div>
              <label className="form-label">Confirm password</label>
              <input
                {...register('confirmPassword')}
                type={showPwd ? 'text' : 'password'}
                className="form-input"
                placeholder="Type it again"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? 'Creating your account...' : 'Claim my profile'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account? <Link href="/login" className="text-saffron-600 font-medium hover:text-saffron-700">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
