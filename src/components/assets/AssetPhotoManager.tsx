'use client'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, Trash2, Loader2, Upload } from 'lucide-react'

interface AssetPhoto { id: string; caption: string | null }

function Thumb({ photoId }: { photoId: string }) {
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

export default function AssetPhotoManager({ assetId, canManage }: { assetId: string; canManage: boolean }) {
  const [photos, setPhotos] = useState<AssetPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () =>
    fetch(`/api/assets/${assetId}/photos`)
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos ?? []))
      .catch(() => {})

  useEffect(() => { load() }, [assetId])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/assets/${assetId}/photos`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast.success('Photo added')
      await load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async (photoId: string) => {
    await fetch(`/api/assets/${assetId}/photos?photoId=${photoId}`, { method: 'DELETE' })
    setPhotos((p) => p.filter((x) => x.id !== photoId))
  }

  if (photos.length === 0 && !canManage) return null

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <Camera className="w-4 h-4 text-saffron-600" /> Photos
      </h2>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                <Thumb photoId={p.id} />
              </div>
              {canManage && (
                <button onClick={() => remove(p.id)}
                  className="w-full text-xs text-gray-500 hover:text-red-500 flex items-center justify-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <label className="btn-secondary text-sm w-full flex items-center justify-center gap-1.5 cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading...' : 'Add photo'}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
            onChange={onFile} disabled={uploading} className="hidden" />
        </label>
      )}
    </div>
  )
}
