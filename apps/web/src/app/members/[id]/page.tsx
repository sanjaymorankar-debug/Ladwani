'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '../../../lib/api-client'
import { errorMessage } from '../../../lib/auth-context'
import { RequireAuth, TopBar, Shell, ErrorBanner, StatusPill, Avatar } from '../../../components/ui'

interface MemberDetail {
  id: string
  firstName: string
  lastName: string | null
  gender: string
  status: string
  maritalStatus?: string
  currentCity?: string
  dateOfBirth?: string | null
}

const MARITAL_STATUSES = ['UNMARRIED', 'MARRIED', 'WIDOWED', 'DIVORCED', 'SEPARATED', 'NOT_STATED']

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [member, setMember] = useState<MemberDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [maritalOpen, setMaritalOpen] = useState(false)
  const [maritalStatus, setMaritalStatus] = useState('UNMARRIED')
  const [spouseMode, setSpouseMode] = useState<'NON_COMMUNITY' | 'EXISTING_MEMBER'>('NON_COMMUNITY')
  const [externalSpouseName, setExternalSpouseName] = useState('')
  const [spouseMemberId, setSpouseMemberId] = useState('')

  const [deceasedOpen, setDeceasedOpen] = useState(false)
  const [deceasedAt, setDeceasedAt] = useState('')
  const [deceasedPlace, setDeceasedPlace] = useState('')

  function load() {
    api
      .get<MemberDetail>(`/members/${id}`)
      .then(setMember)
      .catch((err) => setError(errorMessage(err)))
  }

  useEffect(load, [id])

  async function submitMaritalStatus(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await api.patch(`/members/${id}/marital-status`, {
        status: maritalStatus,
        ...(maritalStatus === 'MARRIED'
          ? spouseMode === 'EXISTING_MEMBER'
            ? { spouseMode, spouseMemberId }
            : { spouseMode, externalSpouseName }
          : {}),
      })
      setNotice('Submitted for Operator review.')
      setMaritalOpen(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function submitDeceased(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await api.patch(`/members/${id}/deceased`, { deceasedAt, deceasedPlace: deceasedPlace || undefined })
      setNotice('Submitted for Operator/Admin review.')
      setDeceasedOpen(false)
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

        {member && (
          <>
            <div className="row" style={{ marginBottom: 20 }}>
              <Avatar name={`${member.firstName} ${member.lastName ?? ''}`} deceased={member.status === 'DECEASED'} />
              <div>
                <h1 style={{ marginBottom: 4 }}>
                  {member.firstName} {member.lastName ?? ''}
                </h1>
                <div className="row">
                  <StatusPill status={member.status} />
                  {member.maritalStatus && <StatusPill status={member.maritalStatus} />}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <dl className="stack" style={{ margin: 0 }}>
                {member.currentCity && (
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <dt className="muted">Current city</dt>
                    <dd style={{ margin: 0 }}>{member.currentCity}</dd>
                  </div>
                )}
                {member.dateOfBirth && (
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <dt className="muted">Date of birth</dt>
                    <dd className="mono" style={{ margin: 0 }}>
                      {new Date(member.dateOfBirth).toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {member.status !== 'DECEASED' && (
              <div className="row">
                <button className="btn btn-outline" onClick={() => setMaritalOpen((v) => !v)}>
                  Update marital status
                </button>
                <button className="btn btn-danger" onClick={() => setDeceasedOpen((v) => !v)}>
                  Mark deceased
                </button>
              </div>
            )}

            {maritalOpen && (
              <form onSubmit={submitMaritalStatus} className="card stack" style={{ marginTop: 16 }}>
                <h3>Update marital status</h3>
                <div className="field">
                  <label htmlFor="maritalStatus">Status</label>
                  <select id="maritalStatus" value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)}>
                    {MARITAL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                {maritalStatus === 'MARRIED' && (
                  <>
                    <div className="field">
                      <label htmlFor="spouseMode">Spouse</label>
                      <select id="spouseMode" value={spouseMode} onChange={(e) => setSpouseMode(e.target.value as never)}>
                        <option value="NON_COMMUNITY">Not on the platform</option>
                        <option value="EXISTING_MEMBER">Existing platform member</option>
                      </select>
                    </div>
                    {spouseMode === 'NON_COMMUNITY' ? (
                      <div className="field">
                        <label htmlFor="externalSpouseName">Spouse&apos;s name</label>
                        <input id="externalSpouseName" value={externalSpouseName} onChange={(e) => setExternalSpouseName(e.target.value)} required />
                      </div>
                    ) : (
                      <div className="field">
                        <label htmlFor="spouseMemberId">Spouse&apos;s member ID</label>
                        <input id="spouseMemberId" value={spouseMemberId} onChange={(e) => setSpouseMemberId(e.target.value)} required />
                      </div>
                    )}
                  </>
                )}
                <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>
                  Submit for review
                </button>
              </form>
            )}

            {deceasedOpen && (
              <form onSubmit={submitDeceased} className="card stack" style={{ marginTop: 16, borderColor: 'var(--danger)' }}>
                <h3>Mark as deceased</h3>
                <p className="muted">This is irreversible once approved and requires Operator/Admin sign-off.</p>
                <div className="field">
                  <label htmlFor="deceasedAt">Date</label>
                  <input id="deceasedAt" type="date" value={deceasedAt} onChange={(e) => setDeceasedAt(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="deceasedPlace">Place (optional)</label>
                  <input id="deceasedPlace" value={deceasedPlace} onChange={(e) => setDeceasedPlace(e.target.value)} />
                </div>
                <button className="btn btn-danger" type="submit" style={{ alignSelf: 'flex-start' }}>
                  Submit for review
                </button>
              </form>
            )}
          </>
        )}
      </Shell>
    </RequireAuth>
  )
}
