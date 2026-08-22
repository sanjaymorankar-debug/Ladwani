'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, CheckCircle2, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { registerSchema, type RegisterInput } from '@/lib/validators'

const steps = ['Account', 'Complete']

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { consentAccepted: true },
  })

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          mobile: data.mobile,
          password: data.password,
          consentAccepted: data.consentAccepted,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Registration failed')
      toast.success('Account created!')
      setStep(1)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-saffron-50 via-orange-50 to-amber-50 flex flex-col">
      <div className="h-1 bg-gradient-to-r from-saffron-400 via-orange-500 to-amber-400" />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-saffron-500 to-saffron-700 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">म</span>
              </div>
              <div className="font-bold text-gray-900">Mi Ladwani</div>
            </Link>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? 'bg-green-500 text-white' :
                  i === step ? 'bg-saffron-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === step ? 'text-saffron-700' : 'text-gray-400'}`}>{s}</span>
                {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200 ml-1" />}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {step === 0 && (
              <>
                <h1 className="text-2xl font-bold text-gray-900 font-display mb-1">Create your account</h1>
                <p className="text-gray-500 text-sm mb-6">Join the Ladwani Samaj community platform</p>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">First Name *</label>
                      <input {...register('firstName')} className="form-input" placeholder="Ramesh" />
                      {errors.firstName && <p className="form-error">{errors.firstName.message}</p>}
                    </div>
                    <div>
                      <label className="form-label">Last Name *</label>
                      <input {...register('lastName')} className="form-input" placeholder="Ladwani" />
                      {errors.lastName && <p className="form-error">{errors.lastName.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Mobile Number *</label>
                    <input {...register('mobile')} className="form-input" placeholder="9876543210" maxLength={10} />
                    {errors.mobile && <p className="form-error">{errors.mobile.message}</p>}
                  </div>

                  <div>
                    <label className="form-label">Email Address (optional)</label>
                    <input {...register('email')} type="email" className="form-input" placeholder="email@example.com" />
                    {errors.email && <p className="form-error">{errors.email.message}</p>}
                  </div>

                  <div>
                    <label className="form-label">Password *</label>
                    <div className="relative">
                      <input
                        {...register('password')}
                        type={showPwd ? 'text' : 'password'}
                        className="form-input pr-10"
                        placeholder="Min 8 chars, uppercase & number"
                      />
                      <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="form-error">{errors.password.message}</p>}
                  </div>

                  <div>
                    <label className="form-label">Confirm Password *</label>
                    <div className="relative">
                      <input
                        {...register('confirmPassword')}
                        type={showConfirm ? 'text' : 'password'}
                        className="form-input pr-10"
                        placeholder="Repeat your password"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="form-error">{errors.confirmPassword.message}</p>}
                  </div>

                  <div className="bg-saffron-50 rounded-lg p-4 text-sm text-gray-600 border border-saffron-100">
                    <p className="font-medium text-gray-800 mb-1">Data Privacy Notice</p>
                    By creating an account, you consent to your information being stored on the Mi Ladwani community
                    platform for community directory, family registry, and matrimonial purposes.
                  </div>

                  <button type="submit" disabled={isLoading}
                    className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-70">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                  Already have an account?{' '}
                  <Link href="/login" className="text-saffron-600 hover:text-saffron-700 font-medium">Sign in</Link>
                </p>
              </>
            )}

            {step === 1 && (
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Mi Ladwani!</h2>
                <p className="text-gray-500 mb-6">
                  Your account has been created. You can now sign in and join your family.
                </p>
                <Link href="/login" className="btn-primary inline-flex items-center gap-2 px-8 py-3">
                  Sign In Now
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
