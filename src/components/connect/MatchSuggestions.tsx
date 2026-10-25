'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Sparkles } from 'lucide-react'
import { BASE_PATH } from '@/lib/api-path'

const SECTIONS = [
  { key: 'canTeachYou', title: 'Members who can teach what you want to learn' },
  { key: 'lookingForYourOffer', title: 'Members looking for what you offer' },
  { key: 'hobbyInYourCity', title: 'People with your hobby in your city' },
  { key: 'newInYourCity', title: 'New in your city' },
] as const

/** Dashboard suggestions — built only from what both people chose to share with the community. */
export default function MatchSuggestions({ memberId }: { memberId: string }) {
  const [matches, setMatches] = useState<Record<string, any[]> | null>(null)
  useEffect(() => { fetch(`${BASE_PATH}/api/matches`).then((r) => r.json()).then((d) => setMatches(d.matches)) }, [])
  if (!matches) return null
  const any = SECTIONS.some((s) => matches[s.key]?.length)

  const connect = async (toMemberId: string) => {
    const res = await fetch(`${BASE_PATH}/api/contact-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toMemberId, purpose: 'CONNECT' }) })
    toast[res.ok ? 'success' : 'error']((await res.json()).message)
  }
  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Sparkles className="w-4 h-4 text-saffron-600" /> Suggestions for you</h2>
      {!any && (
        <p className="text-sm text-gray-500">
          Add hobbies, skills or career details in <Link className="underline" href={`/members/${memberId}/additional-details`}>Additional Details</Link> and share them with the community to see people to connect with.
        </p>
      )}
      {SECTIONS.filter((s) => matches[s.key]?.length).map((s) => (
        <div key={s.key}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{s.title}</p>
          <div className="space-y-1">
            {matches[s.key].map((m: any) => (
              <div key={m.memberId} className="flex items-center justify-between text-sm">
                <span><Link href={`/members/${m.memberId}`} className="font-medium text-gray-900 hover:text-saffron-700">{m.name}</Link>
                  <span className="text-gray-500"> · {m.reason}{m.city ? ` · ${m.city}` : ''}</span></span>
                <button className="text-xs text-saffron-700" onClick={() => connect(m.memberId)}>Request contact</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
