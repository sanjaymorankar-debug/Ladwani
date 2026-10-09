import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageFamily, canViewFamily } from '@/lib/family-auth'
import { operatorCoversFamily } from '@/lib/family-rules'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, MapPin, TreePine, Users, CheckCircle2, Home, Calendar, Plus } from 'lucide-react'
import { formatDate, calculateAge, GENDER_LABELS, MARITAL_STATUS_LABELS } from '@/lib/utils'
import JoinRequestsInbox from '@/components/family/JoinRequestsInbox'
import ChangeKartaPanel from '@/components/family/ChangeKartaPanel'
import FamilyPhoto from '@/components/family/FamilyPhoto'
import MemberManageActions from '@/components/family/MemberManageActions'
import NewbornPanel from '@/components/family/NewbornPanel'
import JoinFamilyPanel from '@/components/family/JoinFamilyPanel'

export default async function FamilyDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const isKarta = await canManageFamily(session, params.id)
  const roles = ((session.user as any)?.roles ?? []) as string[]
  // F18: an Operator of the family's district may view it to correct roles.
  const isDistrictOperator = !isKarta && (await operatorCoversFamily(session.user?.id as string, roles, params.id))
  const isMember = await canViewFamily(session, params.id)

  // F14: before joining, only a limited summary is visible.
  if (!isMember && !isDistrictOperator) {
    const summary = await prisma.family.findUnique({
      where: { id: params.id, deletedAt: null },
      select: {
        id: true, name: true, registrationNumber: true, gotra: true, nativeVillage: true, nativeDistrict: true, nativeState: true,
        kartaMemberId: true, karta: { select: { firstName: true, lastName: true } },
        _count: { select: { members: { where: { leftAt: null } } } },
      },
    })
    if (!summary) notFound()
    const viewerGender = (await prisma.member.findUnique({ where: { id: (session.user as any).memberId ?? '' }, select: { gender: true } }))?.gender ?? null
    const kartaName = summary.karta ? `${summary.karta.firstName} ${summary.karta.lastName ?? ''}`.trim() : null
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="card">
          <h1 className="text-2xl font-bold text-gray-900 font-display">{summary.name} Family</h1>
          <div className="text-sm text-gray-600 mt-2 space-y-1">
            <p><span className="badge-orange">{summary.registrationNumber}</span></p>
            {kartaName && <p>Karta: {kartaName}</p>}
            {summary.gotra && <p>Gotra: {summary.gotra}</p>}
            {summary.nativeVillage && <p>Mul Gaon: {[summary.nativeVillage, summary.nativeDistrict, summary.nativeState].filter(Boolean).join(', ')}</p>}
            <p>{summary._count.members} members</p>
          </div>
        </div>
        <JoinFamilyPanel familyId={summary.id} kartaMemberId={summary.kartaMemberId} kartaName={kartaName} gender={viewerGender} />
      </div>
    )
  }

  const family = await prisma.family.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      members: {
        where: { leftAt: null },
        include: {
          member: {
            include: {
              education: { where: { isHighest: true }, take: 1 },
            },
          },
        },
        orderBy: { isKarta: 'desc' },
        take: 30,
      },
      addresses: true,
      familyAreas: { include: { area: true }, take: 3 },
    },
  })

  if (!family) notFound()

  // Living members with no login of their own — candidates for an invitation (§12).
  const unclaimed = family.members.filter(({ member }: any) => !member.userId && !member.deceasedAt)

  // Possible successors: active adults with their own login, other than the current Karta.
  const kartaCandidates = family.members
    .filter(({ member, isKarta: k }: any) => {
      if (k || !member.userId || member.status !== 'ACTIVE') return false
      return !member.dateOfBirth || (calculateAge(member.dateOfBirth) ?? 18) >= 18
    })
    .map(({ member }: any) => ({ id: member.id, name: `${member.firstName} ${member.lastName ?? ''}`.trim() }))

  // Rule 1 / F24: each membership's role, labelled from the relationship master.
  const roleTypes = await prisma.relationshipType.findMany({
    where: { code: { in: family.members.map((m: any) => m.relationshipRole).filter(Boolean) } },
    select: { code: true, label: true },
  })
  const roleLabel = new Map(roleTypes.map((t) => [t.code, t.label]))
  const relatives = family.members.map(({ member }: any) => ({ id: member.id, name: `${member.firstName} ${member.lastName ?? ''}`.trim() }))
  const living = family.members.filter(({ member }: any) => member.status !== 'DECEASED')
  const adults = (g: string) => living.filter(({ member }: any) => member.gender === g && (calculateAge(member.dateOfBirth) ?? 18) >= 15)
    .map(({ member }: any) => ({ id: member.id, name: `${member.firstName} ${member.lastName ?? ''}`.trim() }))

  const currentAddress = family.addresses.find((a: any) => a.addressType === 'CURRENT')
  const nativeAddress = family.addresses.find((a: any) => a.addressType === 'NATIVE')

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/members" className="btn-ghost p-2 -ml-2"><ArrowLeft className="w-4 h-4" /></Link>
        <span className="text-gray-400 text-sm">Family Directory</span>
      </div>

      {/* Family card */}
      <div className="card">
        <div className="flex items-start gap-5">
          <FamilyPhoto familyId={family.id} photoId={family.familyPhotoId} initial={family.name[0]} canEdit={isKarta} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
                  {family.name} Family
                  {family.verificationStatus === 'VERIFIED' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                </h1>
                {family.surname && <p className="text-gray-500 text-sm">{family.surname}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="badge-orange">{family.registrationNumber}</span>
                  <span className={`badge text-xs ${family.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>
                    {family.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/family/${family.id}/tree`} className="btn-secondary text-sm flex items-center gap-1.5">
                  <TreePine className="w-4 h-4" /> View Tree
                </Link>
                {isKarta && (
                  <Link href={`/family/${family.id}/members/new`} className="btn-primary text-sm flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Add Member
                  </Link>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">
              {(currentAddress?.city || family.nativeVillage) && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {currentAddress?.city ? (
                    <span>{currentAddress.city}{currentAddress.state ? `, ${currentAddress.state}` : ''}</span>
                  ) : (
                    <span>Native: {family.nativeVillage}{family.nativeState ? `, ${family.nativeState}` : ''}</span>
                  )}
                </div>
              )}
              {family.nativeVillage && currentAddress && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Home className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  Native: {family.nativeVillage}{family.nativeState ? `, ${family.nativeState}` : ''}
                </div>
              )}
              {family.kuladevata && (
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="text-gray-400 text-sm">🙏</span>
                  Kuladevata: {family.kuladevata}
                </div>
              )}
              {family.gotra && (
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="text-gray-400 text-sm">🌿</span>
                  Gotra: {family.gotra}
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                Registered {formatDate(family.createdAt)}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {family.members.length} member{family.members.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {family.description && (
          <p className="text-gray-600 text-sm mt-4 pt-4 border-t border-gray-100 leading-relaxed">
            {family.description}
          </p>
        )}
      </div>

      {family.status === 'KARTA_VACANT' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This family has no Karta. An Operator of the district will confirm the new Karta (the eldest adult is suggested).
        </div>
      )}

      {isKarta && <JoinRequestsInbox familyId={family.id} />}

      {isKarta && <NewbornPanel familyId={family.id} fathers={adults('MALE')} mothers={adults('FEMALE')} />}

      {isKarta && <ChangeKartaPanel familyId={family.id} candidates={kartaCandidates} />}

      {isKarta && unclaimed.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-saffron-600" /> Invite members to create their own account
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            These profiles are managed by you. Send an invitation so the person can take over their own profile.
          </p>
          <ul className="mt-3 divide-y divide-gray-100">
            {unclaimed.map(({ member }: any) => (
              <li key={member.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-800">{member.firstName} {member.lastName ?? ''}</span>
                <Link href={`/members/${member.id}`} className="btn-secondary text-xs">Invite</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Members */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Family Members</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {family.members.map(({ member, isKarta: memberIsKarta, relationshipRole }: any) => {
            const age = calculateAge(member.dateOfBirth)
            const edu = member.education[0]
            const late = member.status === 'DECEASED'
            return (
              <div key={member.id} className="card-hover block">
              <Link href={`/members/${member.id}`} className="block">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${
                    member.gender === 'MALE' ? 'bg-blue-500' : member.gender === 'FEMALE' ? 'bg-pink-500' : 'bg-gray-400'
                  }`}>
                    {member.firstName[0]}{member.lastName?.[0] ?? ''}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {late ? 'Late ' : ''}{member.firstName} {member.lastName ?? ''}
                      </p>
                      {memberIsKarta && <span className="badge-orange text-xs shrink-0">Karta</span>}
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5 mt-0.5">
                      {relationshipRole && relationshipRole !== 'karta' && <div className="text-saffron-700">{roleLabel.get(relationshipRole) ?? relationshipRole}</div>}
                      <div>{GENDER_LABELS[member.gender as keyof typeof GENDER_LABELS] ?? member.gender} {age ? `· ${age} yrs` : ''}</div>
                      <div>{MARITAL_STATUS_LABELS[member.maritalStatus as keyof typeof MARITAL_STATUS_LABELS] ?? member.maritalStatus}</div>
                      {member.currentCity && <div>{member.currentCity}</div>}
                      {edu && <div className="truncate">{edu.qualification ?? edu.level}</div>}
                    </div>
                  </div>
                </div>
              </Link>
              {(isKarta || isDistrictOperator) && !memberIsKarta && (
                <MemberManageActions familyId={family.id} memberId={member.id} gender={member.gender}
                  canRemove={isKarta} isOperator={isDistrictOperator}
                  relatives={relatives.filter((r: any) => r.id !== member.id)} />
              )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
