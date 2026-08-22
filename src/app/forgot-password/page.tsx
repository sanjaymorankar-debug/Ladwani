'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Step = 'request' | 'verify' | 'reset' | 'done'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('request')
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const requestOtp = async () => {
    if (!identifier.trim()) return toast.error('Enter your mobile or email')
    setIsLoading(true)
    try {
      const isMobile = /^\d{10}$/.test(identifier)
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'request',
          ...(isMobile ? { mobile: identifier } : { email: identifier }),
        }),
      })
      await res.json()
      toast.success('OTP sent! Check your mobile/email.')
      setStep('verify')
    } catch { toast.error('Something went wrong') }
    finally { setIsLoading(false) }
  }

  const resetPassword = async () => {
    if (password !== confirm) return toast.error('Passwords do not match')
    if (password.length < 8) return toast.error('Password must be at least 8 characters')
    setIsLoading(true)
    try {
      const isMobile = /^\d{10}$/.test(identifier)
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'confirm',
          otp,
          newPassword: password,
          ...(isMobile ? { mobile: identifier } : { email: identifier }),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      setStep('done')
    } catch (e: any) { toast.error(e.message) }
    finally { setIsLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
      <div className="h-1 bg-gradient-to-r from-saffron-400 via-orange-500 to-amber-400" />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-saffron-500 to-saffron-700 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">म</span>
              </div>
              <div className="font-bold text-gray-900">Mi Ladwani</div>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {step === 'done' ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Password Reset!</h2>
                <p className="text-gray-500 text-sm mb-6">Your password has been updated. Sign in with your new password.</p>
                <Link href="/login" className="btn-primary px-8 py-3 inline-block">Sign In</Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <Link href="/login" className="text-gray-400 hover:text-gray-600">
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Reset Password</h1>
                    <p className="text-xs text-gray-500">
                      {step === 'request' ? 'Enter your mobile or email' :
                       step === 'verify' ? 'Enter the OTP you received' : 'Set a new password'}
                    </p>
                  </div>
                </div>

                {/* Step indicator */}
                <div className="flex gap-1 mb-6">
                  {['request', 'verify', 'reset'].map((s, i) => (
                    <div key={s} className={`flex-1 h-1.5 rounded-full ${
                      ['request','verify','reset'].indexOf(step) >= i ? 'bg-saffron-500' : 'bg-gray-200'
                    }`} />
                  ))}
                </div>

                {step === 'request' && (
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">Mobile Number or Email</label>
                      <input
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="form-input"
                        placeholder="9876543210 or email@example.com"
                        onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
                      />
                    </div>
                    <button onClick={requestOtp} disabled={isLoading}
                      className="w-full btn-primary py-3 flex items-center justify-center gap-2">
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Send OTP
                    </button>
                  </div>
                )}

                {step === 'verify' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 bg-saffron-50 rounded-lg p-3 border border-saffron-100">
                      OTP sent to <strong>{identifier}</strong>
                    </p>
                    <div>
                      <label className="form-label">Enter OTP</label>
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="form-input text-center text-2xl tracking-widest font-mono"
                        placeholder="• • • • • •"
                        maxLength={6}
                      />
                    </div>
                    <button onClick={() => setStep('reset')} disabled={otp.length < 6}
                      className="w-full btn-primary py-3 disabled:opacity-60">
                      Verify OTP
                    </button>
                    <button onClick={requestOtp} className="w-full text-sm text-gray-500 hover:text-saffron-600">
                      Resend OTP
                    </button>
                  </div>
                )}

                {step === 'reset' && (
                  <div className="space-y-4">
                    <div>
                      <label className="form-label">New Password</label>
                      <input
                        type="password" value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="form-input" placeholder="Min 8 characters"
                      />
                    </div>
                    <div>
                      <label className="form-label">Confirm New Password</label>
                      <input
                        type="password" value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className="form-input" placeholder="Repeat password"
                        onKeyDown={(e) => e.key === 'Enter' && resetPassword()}
                      />
                    </div>
                    <button onClick={resetPassword} disabled={isLoading}
                      className="w-full btn-primary py-3 flex items-center justify-center gap-2">
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Reset Password
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
