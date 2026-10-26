'use client'
import { BASE_PATH } from '@/lib/api-path'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Images, Flag, Trash2 } from 'lucide-react'

function Thumb({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { fetch(`${BASE_PATH}/api/photos/${id}/url?variant=thumbnail`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setUrl(d.url)).catch(() => {}) }, [id])
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-100 animate-pulse" />
}

/** F34 family album: members add photos with Only me / Family / Friends / Community visibility; report abuse. */
export default function FamilyAlbum({ familyId, canManage }: { familyId: string; canManage: boolean }) {
  const [photos, setPhotos] = useState<any[]>([])
  const [visibility, setVisibility] = useState('SAME_FAMILY')
  const fileRef = useRef<HTMLInputElement>(null)
  const load = () => fetch(`${BASE_PATH}/api/families/${familyId}/album`).then((r) => r.json()).then((d) => setPhotos(d.photos ?? []))
  useEffect(() => { load() }, [familyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (file: File) => {
    const fd = new FormData(); fd.append('file', file); fd.append('visibility', visibility)
    const res = await fetch(`${BASE_PATH}/api/families/${familyId}/album`, { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) return toast.error(json.message)
    toast.success('Photo added'); load()
  }
  const report = async (id: string) => {
    const reason = window.prompt('What is wrong with this photo?')?.trim()
    if (!reason) return
    const res = await fetch(`${BASE_PATH}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'photo', id, reason }) })
    const json = await res.json()
    res.ok ? toast.success(json.message) : toast.error(json.message)
  }
  const remove = async (id: string) => {
    const res = await fetch(`${BASE_PATH}/api/photos/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Images className="w-5 h-5 text-saffron-600" /> Family album</h2>
        <div className="flex items-center gap-2">
          <select className="form-input text-xs py-1" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="SAME_FAMILY">Family</option><option value="PRIVATE">Only me</option><option value="FRIENDS">My friends</option><option value="REGISTERED_MEMBERS">Community</option>
          </select>
          <button className="btn-secondary text-xs" onClick={() => fileRef.current?.click()}>Add photo</button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
            <Thumb id={p.id} />
            <div className="absolute inset-x-0 bottom-0 bg-black/40 text-white text-[10px] px-1 py-0.5 flex items-center justify-between opacity-0 group-hover:opacity-100">
              <span className="truncate">{p.uploadedBy}</span>
              {p.mine || canManage
                ? <button title="Delete" onClick={() => remove(p.id)}><Trash2 className="w-3 h-3" /></button>
                : <button title="Report abuse" onClick={() => report(p.id)}><Flag className="w-3 h-3" /></button>}
            </div>
          </div>
        ))}
        {!photos.length && <p className="text-sm text-gray-500 col-span-full">No photos yet.</p>}
      </div>
    </div>
  )
}
