'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft, Building2, Loader2, Search, CheckCircle2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

const schema = z.object({
  name: z.string().min(2, 'Family name required'),
  surname: z.string().optional(),
  description: z.string().optional(),
  kuladevata: z.string().optional(),
  kuladevi: z.string().optional(),
  gotra: z.string().optional(),
  traditionalOccupation: z.string().optional(),
  nativeVillage: z.string().optional(),
  nativeDistrict: z.string().optional(),
  nativeState: z.string().optional(),
  nativeCountry: z.string().default('India'),
})
type FormData = z.infer<typeof schema>

type Mode = 'choose' | 'search' | 'register'

export default function FamilySetupPage() {
  return (
    <Suspense fallback={null}>
      <FamilySetup />
    </Suspense>
  )
}

function FamilySetup() {
  const router = useRouter()
  const { update } = useSession()
  const searchParams = useSearchParams()
  // ?mode=register / ?mode=search comes from the choice made at registration,
  // so a user who said "I am the Karta" lands straight on the family
  // registration form instead of being asked to choose again.
  const initialMode = searchParams.get('mode')
  const [mode, setMode] = useState<Mode>(
    initialMode === 'register' || initialMode === 'search' ? initialMode : 'choose'
  )
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [joiningFamilyId, setJoiningFamilyId] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nativeCountry: 'India' },
  })

  const doSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch(`/api/families?q=${encodeURIComponent(searchQuery)}&limit=10`)
      const data = await res.json()
      setSearchResults(data.families ?? [])
    } finally { setIsSearching(false) }
  }

  const requestJoin = async (familyId: string, familyName: string) => {
    setJoiningFamilyId(familyId)
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Failed to send request')
      toast.success(`Join request sent for ${familyName}! The family head will be notified.`)
      router.push('/dashboard')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setJoiningFamilyId(null)
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? json.message ?? 'Failed')
      // Pick up the freshly-granted KARTA role without forcing a re-login.
      await update()
      toast.success('Family registered — you are now its Karta. Submitted for verification.')
      router.push(`/family/${json.familyId}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/family" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900">Family Setup</h1>
      </div>

      {mode === 'choose' && (
        <div className="space-y-4">
          <div className="card text-center py-8 border-2 border-gray-200">
            <div className="w-14 h-14 bg-saffron-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-saffron-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Connect to Your Family</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              Search for your family if it&apos;s already registered, or register a new one.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <button onClick={() => setMode('search')}
              className="card text-left hover:border-saffron-300 hover:shadow-md transition-all cursor-pointer border-2">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                <Search className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Find My Family</h3>
              <p className="text-sm text-gray-500">My family is already registered. I want to join it.</p>
            </button>

            <button onClick={() => setMode('register')}
              className="card text-left hover:border-saffron-300 hover:shadow-md transition-all cursor-pointer border-2">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
                <Plus className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Register New Family</h3>
              <p className="text-sm text-gray-500">My family isn&apos;t on the platform yet. Register it.</p>
            </button>
          </div>
        </div>
      )}

      {mode === 'search' && (
        <div className="space-y-4">
          <button onClick={() => setMode('choose')} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Search for Your Family</h2>
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                className="form-input flex-1"
                placeholder="Family name, native village, surname..."
              />
              <button onClick={doSearch} disabled={isSearching} className="btn-primary px-4">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{f.name} Family</p>
                      <div className="flex gap-2 mt-0.5 text-xs text-gray-500">
                        <span>{f.registrationNumber}</span>
                        {f.addresses?.[0]?.city && <span>· {f.addresses[0].city}</span>}
                        <span>· {f._count?.members ?? 0} members</span>
                      </div>
                    </div>
                    <button
                      onClick={() => requestJoin(f.id, f.name)}
                      disabled={joiningFamilyId === f.id}
                      className="btn-primary text-xs px-3 py-1.5 disabled:opacity-70"
                    >
                      {joiningFamilyId === f.id ? 'Sending...' : 'Request to Join'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !isSearching && (
              <div className="mt-4 text-center py-6">
                <p className="text-gray-500 text-sm">No families found.</p>
                <button onClick={() => setMode('register')} className="text-saffron-600 text-sm font-medium mt-2 hover:text-saffron-700">
                  Register a new family instead →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'register' && (
        <div className="space-y-4">
          <button onClick={() => setMode('choose')} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
            <strong>Before registering:</strong> Please search to make sure your family isn&apos;t already registered. Duplicate registrations will be merged by our team.
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Family Information</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Family Name *</label>
                  <input {...register('name')} className="form-input" placeholder="e.g. Sharma" />
                  {errors.name && <p className="form-error">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="form-label">Surname / Gotra Name</label>
                  <input {...register('surname')} className="form-input" placeholder="e.g. Ladwani" />
                </div>
              </div>
              <div>
                <label className="form-label">Family Description</label>
                <textarea {...register('description')} className="form-input min-h-[80px]"
                  placeholder="Brief description of your family..." />
              </div>
            </div>

            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Cultural Information <span className="text-xs text-gray-400 font-normal">(all optional)</span></h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Kuladevata</label>
                  <input {...register('kuladevata')} className="form-input" placeholder="Family deity" />
                </div>
                <div>
                  <label className="form-label">Kuladevi</label>
                  <input {...register('kuladevi')} className="form-input" placeholder="Family goddess" />
                </div>
                <div>
                  <label className="form-label">Gotra</label>
                  <input {...register('gotra')} className="form-input" placeholder="Gotra" />
                </div>
                <div>
                  <label className="form-label">Traditional Occupation</label>
                  <input {...register('traditionalOccupation')} className="form-input" placeholder="e.g. Farming, Trading" />
                </div>
              </div>
            </div>

            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Native Place</h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Village / Town</label>
                  <input {...register('nativeVillage')} className="form-input" placeholder="Village name" />
                </div>
                <div>
                  <label className="form-label">District</label>
                  <input {...register('nativeDistrict')} className="form-input" placeholder="District" />
                </div>
                <div>
                  <label className="form-label">State</label>
                  <input {...register('nativeState')} className="form-input" placeholder="Maharashtra" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-70">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {isLoading ? 'Submitting...' : 'Submit Family Registration'}
            </button>
            <p className="text-center text-xs text-gray-400">
              Your registration will be reviewed by a platform operator before activation.
            </p>
          </form>
        </div>
      )}
    </div>
  )
}
