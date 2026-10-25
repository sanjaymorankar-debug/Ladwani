import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { visibleMatrimonyWhere } from '@/lib/matrimony'
import { canBrowse, profileCards, bureauEligibility, workbookRules } from '@/lib/bureau'
import SendInterestButton from '@/components/matrimony/SendInterestButton'
import { EDUCATION_CORE_SELECT } from '@/lib/additional-details/core-selects'

/** F38 limited profile: no contact details, income as a band, same-Gotra flagged. */
export default async function BureauProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  if (!(await canBrowse(session))) notFound()
  const listed = await prisma.matrimonialProfile.findFirst({ where: { id: params.id, ...visibleMatrimonyWhere } })
  if (!listed || ((await workbookRules()) && !(await bureauEligibility(listed.memberId)).ok)) notFound()
  const [p] = await profileCards([listed.id], (session.user as any).memberId ?? null)
  if (!p) notFound()
  const row = (label: string, value: unknown) => (value ? <div><dt className="text-xs text-gray-500">{label}</dt><dd className="text-gray-900">{String(value)}</dd></div> : null)
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link href="/matrimony" className="btn-ghost text-sm inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <div className="card space-y-3">
        <h1 className="text-xl font-bold text-gray-900">{p.name}</h1>
        {p.sameGotra && <p className="flex items-center gap-1 text-sm text-red-700 bg-red-50 rounded px-2 py-1"><AlertTriangle className="w-4 h-4" /> Same Gotra as yours ({p.gotra})</p>}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {row('Age', p.age)}{row('Height', p.heightCm ? `${p.heightCm} cm` : null)}
          {row('Mul Gaon', [p.mulGaon, p.district].filter(Boolean).join(', '))}{row('Gotra', p.gotra)}
          {row('Education', p.education?.qualification ?? p.education?.level)}{row('Occupation', p.occupation)}
          {row('Income band', p.incomeBand)}{row('Marital status', p.maritalStatus?.toLowerCase())}
        </dl>
        {p.about && <p className="text-sm text-gray-700">{p.about}</p>}
        {p.expectations && <div className="text-sm"><p className="text-xs text-gray-500">Expectations</p><p>{p.expectations}</p></div>}
        {p.horoscope && <div className="text-sm"><p className="text-xs text-gray-500">Horoscope</p><p>{p.horoscope}</p></div>}
        <SendInterestButton toMemberId={p.memberId} />
      </div>
    </div>
  )
}
