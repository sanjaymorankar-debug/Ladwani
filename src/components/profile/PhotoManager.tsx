'use client'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, Star, Trash2, Loader2, Upload } from 'lucide-react'

interface Photo {
  id: string
  isProfilePhoto: boolean
  visibility: string
  thumbnailKey: string | null
}

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Only me' },
  { value: 'SAME_FAMILY', label: 'My family' },
  { value: 'REGISTERED_MEMBERS', label: 'Community members' },
  { value: 'MATRIMONY_ONLY', label: 'Matrimony viewers' },
  { value: 'PUBLIC_COMMUNITY', label: 'Public' },
]

function PhotoThumb({ photoId }: { photoId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    fetch(`/api/photos/${photoId}/url?variant=thumbnail`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUrl(d.url))
      .catch(() => {})
  }, [photoId])
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full bg-gray-100 animate-pulse" />
  )
}

export default function PhotoManager({ memberId }: { memberId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () =>
    fetch(`/api/members/${memberId}/photos`)
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos ?? []))

  useEffect(() => { load() }, [memberId])

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('setAsProfile', String(photos.length === 0))
      const res = await fetch(`/api/members/${memberId}/photos`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast.success('Photo uploaded')
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const setProfile = async (photoId: string) => {
    await fetch(`/api/members/${memberId}/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setAsProfile: true }),
    })
    load()
  }

  const setVisibility = async (photoId: string, visibility: string) => {
    await fetch(`/api/members/${memberId}/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility }),
    })
    load()
  }

  const remove = async (photoId: string) => {
    await fetch(`/api/members/${memberId}/photos/${photoId}`, { method: 'DELETE' })
    setPhotos((p) => p.filter((x) => x.id !== photoId))
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
        <Camera className="w-4 h-4 text-saffron-600" /> Photos
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {photos.map((p) => (
          <div key={p.id} className="space-y-1.5">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              <PhotoThumb photoId={p.id} />
              {p.isProfilePhoto && (
                <span className="absolute top-1 left-1 bg-saffron-500 text-white rounded-full p-1">
                  <Star className="w-3 h-3" fill="currentColor" />
                </span>
              )}
            </div>
            <select
              value={p.visibility}
              onChange={(e) => setVisibility(p.id, e.target.value)}
              className="form-input text-xs py-1"
            >
              {VISIBILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="flex gap-1">
              {!p.isProfilePhoto && (
                <button onClick={() => setProfile(p.id)} className="flex-1 text-xs text-gray-500 hover:text-saffron-600" title="Set as profile photo">
                  <Star className="w-3.5 h-3.5 mx-auto" />
                </button>
              )}
              <button onClick={() => remove(p.id)} className="flex-1 text-xs text-gray-500 hover:text-red-500" title="Delete">
                <Trash2 className="w-3.5 h-3.5 mx-auto" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <label className="btn-secondary text-sm w-full flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Uploading...' : 'Upload Photo'}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} disabled={uploading} className="hidden" />
      </label>
      <p className="text-xs text-gray-400">JPEG, PNG or WEBP, up to 8MB. New uploads default to "Only me" — change visibility per photo above.</p>
    </div>
  )
}
