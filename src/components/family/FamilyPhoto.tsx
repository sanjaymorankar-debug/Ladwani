'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Camera, Loader2 } from 'lucide-react'

/**
 * The family card's picture. Falls back to the initial when there is no photo.
 * The Karta also gets an "Add/Change Photo" control (§13).
 */
export default function FamilyPhoto({
  familyId, photoId, initial, canEdit,
}: { familyId: string; photoId: string | null; initial: string; canEdit: boolean }) {
  const router = useRouter()
  const [url, setUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setUrl(null)
    if (!photoId) return
    fetch(`/api/photos/${photoId}/url`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUrl(d.url))
      .catch(() => {})
  }, [photoId])

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/families/${familyId}/photos`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast.success('Family photo updated')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-saffron-400 to-saffron-600 flex items-center justify-center text-white text-3xl font-bold shadow-sm">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Family photo" className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </div>
      {canEdit && (
        <>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onChange} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="text-xs text-saffron-700 hover:underline inline-flex items-center gap-1 disabled:opacity-60">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            {photoId ? 'Change photo' : 'Add photo'}
          </button>
        </>
      )}
    </div>
  )
}
