'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const FIELDS = [
  { key: 'heightCm', label: 'Height' },
  { key: 'weightKg', label: 'Weight' },
  { key: 'bodyType', label: 'Body type' },
  { key: 'bloodGroup', label: 'Blood group' },
  { key: 'physicalDisability', label: 'Physical disability' },
]

/** Admin switches for which optional physical fields members are asked for (section 16). */
export default function PhysicalFieldsAdmin() {
  const [config, setConfig] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    fetch('/api/settings/physical-fields').then((r) => r.json()).then((d) => setConfig(d.config))
  }, [])

  const toggle = async (key: string) => {
    if (!config) return
    const next = { ...config, [key]: !config[key] }
    setConfig(next)
    const res = await fetch('/api/settings/physical-fields', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
    if (!res.ok) {
      setConfig(config)
      toast.error((await res.json()).message ?? 'Could not save')
    } else {
      toast.success('Saved')
    }
  }

  if (!config) return <div className="card text-sm text-gray-500">Loading...</div>

  return (
    <div className="card divide-y divide-gray-100 p-0">
      {FIELDS.map((f) => (
        <label key={f.key} className="flex items-center justify-between px-4 py-3 text-sm cursor-pointer">
          <span className="text-gray-800">{f.label}</span>
          <input type="checkbox" checked={!!config[f.key]} onChange={() => toggle(f.key)} className="w-4 h-4 accent-saffron-600" />
        </label>
      ))}
    </div>
  )
}
