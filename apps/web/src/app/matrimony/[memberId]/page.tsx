'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '../../../lib/api-client'
import { errorMessage } from '../../../lib/auth-context'
import { RequireAuth, TopBar, Shell, ErrorBanner, Avatar } from '../../../components/ui'

interface ProfileDetail {
  memberId: string
  firstName: string
  lastName: string | null
  age: number | null
  currentCity: string | null
  about: string | null
  heightCm: number | null
  allowContactRequests: boolean
  contactRevealed: boolean
  contact?: { mobile?: string | null; email?: string | null }
}

export default function MatrimonyDetailPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const [profile, setProfile] = useState<ProfileDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<ProfileDetail>(`/matrimony/profiles/${memberId}`)
      .then(setProfile)
      .catch((err) => setError(errorMessage(err)))
  }, [memberId])

  async function sendInterest(kind: 'INTEREST' | 'CONTACT_REQUEST') {
    setError(null)
    setNotice(null)
    try {
      await api.post('/matrimony/interests', { toMemberId: memberId, kind })
      setNotice(kind === 'INTEREST' ? 'Interest sent.' : 'Contact request sent.')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <RequireAuth>
      <TopBar />
      <Shell>
        <ErrorBanner message={error} />
        {notice && <div className="card" style={{ borderColor: 'var(--success)', color: 'var(--success)', marginBottom: 16 }}>{notice}</div>}

        {profile && (
          <>
            <div className="row" style={{ marginBottom: 20 }}>
              <Avatar name={profile.firstName} />
              <div>
                <h1 style={{ marginBottom: 4 }}>
                  {profile.firstName} {profile.lastName ?? ''}
                </h1>
                <p className="muted" style={{ margin: 0 }}>
                  {profile.age ? `${profile.age} yrs` : ''} {profile.currentCity ? `· ${profile.currentCity}` : ''} {profile.heightCm ? `· ${profile.heightCm} cm` : ''}
                </p>
              </div>
            </div>

            {profile.about && (
              <div className="card" style={{ marginBottom: 20 }}>
                <p style={{ margin: 0 }}>{profile.about}</p>
              </div>
            )}

            {profile.contactRevealed && profile.contact && (
              <div className="card" style={{ marginBottom: 20, borderColor: 'var(--success)' }}>
                <h3>Contact details</h3>
                {profile.contact.mobile && <p style={{ margin: 0 }}>Mobile: {profile.contact.mobile}</p>}
                {profile.contact.email && <p style={{ margin: 0 }}>Email: {profile.contact.email}</p>}
              </div>
            )}

            <div className="row">
              <button className="btn btn-accent" onClick={() => sendInterest('INTEREST')}>
                Send Interest
              </button>
              {profile.allowContactRequests && !profile.contactRevealed && (
                <button className="btn btn-outline" onClick={() => sendInterest('CONTACT_REQUEST')}>
                  Request Contact
                </button>
              )}
            </div>
          </>
        )}
      </Shell>
    </RequireAuth>
  )
}
