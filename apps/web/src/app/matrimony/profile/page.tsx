'use client'

import { useEffect, useState } from 'react'
import { api, ApiError } from '../../../lib/api-client'
import { errorMessage } from '../../../lib/auth-context'
import { RequireAuth, TopBar, Shell, ErrorBanner } from '../../../components/ui'

interface MatrimonyProfile {
  about: string | null
  heightCm: number | null
  allowContactRequests: boolean
  isVisible: boolean
}

export default function MatrimonyProfilePage() {
  const [form, setForm] = useState({ about: '', heightCm: '', allowContactRequests: true, isVisible: false })
  const [needsConsent, setNeedsConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api
      .get<MatrimonyProfile | null>('/matrimony/profile')
      .then((p) => {
        if (p) {
          setForm({ about: p.about ?? '', heightCm: p.heightCm ? String(p.heightCm) : '', allowContactRequests: p.allowContactRequests, isVisible: p.isVisible })
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function submit(e: React.FormEvent, consentGranted = false) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await api.put('/matrimony/profile', {
        about: form.about || undefined,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        allowContactRequests: form.allowContactRequests,
        isVisible: form.isVisible,
        consentGranted,
      })
      setNeedsConsent(false)
      setNotice('Profile saved.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && form.isVisible) {
        setNeedsConsent(true)
      } else {
        setError(errorMessage(err))
      }
    }
  }

  if (!loaded) return <Shell>Loading…</Shell>

  return (
    <RequireAuth>
      <TopBar />
      <Shell>
        <h1>My matrimonial profile</h1>
        <form onSubmit={(e) => submit(e)} className="card stack" style={{ marginTop: 20 }}>
          <ErrorBanner message={error} />
          {notice && <div style={{ color: 'var(--success)' }}>{notice}</div>}

          <div className="field">
            <label htmlFor="about">About</label>
            <textarea id="about" rows={4} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="heightCm">Height (cm)</label>
            <input id="heightCm" type="number" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
          </div>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={form.allowContactRequests}
              onChange={(e) => setForm({ ...form, allowContactRequests: e.target.checked })}
            />
            Allow direct contact requests
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} />
            Make my profile visible in matrimony search
          </label>

          {needsConsent && (
            <div className="card stack" style={{ borderColor: 'var(--warning)' }}>
              <p className="muted" style={{ margin: 0 }}>
                Making your profile visible requires your consent to share matrimonial data with other members.
              </p>
              <button type="button" className="btn btn-accent" style={{ alignSelf: 'flex-start' }} onClick={(e) => submit(e, true)}>
                I consent — save and make visible
              </button>
            </div>
          )}

          <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>
            Save
          </button>
        </form>
      </Shell>
    </RequireAuth>
  )
}
