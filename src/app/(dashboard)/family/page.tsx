import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Users, TreePine, MapPin, Plus, Edit, ChevronRight, CheckCircle2 } from 'lucide-react'
import { calculateAge, genderLabel, maritalLabel, MARITAL_STATUS_LABELS, GENDER_LABELS } from '@/lib/utils'

export default async function FamilyPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      member: {
        include: {
          families: {
            include: {
              family: {
                include: {
                  members: {
                    where: { leftAt: null },
                    include: {
                      member: { include: { education: { where: { isHighest: true }, take: 1 } } },
                    },
                    orderBy: { joinedAt: 'asc' },
                  },
                  addresses: { where: { isPrimary: true }, take: 1 },
                },
              },
            },
            take: 1,
          },
        },
      },
    },
  })

  const family = user?.member?.families[0]?.family
  const members = family?.members ?? []
  const address = family?.addresses[0]

  if (!family) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card text-center py-16">
          <div className="w-20 h-20 bg-saffron-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-saffron-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Family Linked</h2>
          <p className="text-gray-600 mb-6 max-w-sm mx-auto">
            You haven&apos;t linked to a family yet. Search for your existing family or register a new one.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/family/setup" className="btn-primary flex items-center gap-2 justify-center">
              <Plus className="w-4 h-4" /> Register New Family
            </Link>
            <Link href="/search?type=families" className="btn-secondary flex items-center gap-2 justify-center">
              Search Existing Family
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-saffron-400 to-saffron-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold font-display shadow-sm">
              {family.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{family.name} Family</h1>
                {family.verificationStatus === 'VERIFIED' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              </div>
              {family.surname && <p className="text-gray-500 text-sm">{family.surname}</p>}
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="badge-orange">{family.registrationNumber}</span>
                {address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {[address.city, address.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link href={`/family/${family.id}/edit`} className="btn-ghost text-sm flex items-center gap-1">
            <Edit className="w-4 h-4" /> Edit
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4 text-sm">
          {family.nativeVillage && (
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-0.5">Native Village</p>
              <p className="text-gray-900">{[family.nativeVillage, family.nativeDistrict, family.nativeState].filter(Boolean).join(', ')}</p>
            </div>
          )}
          {family.kuladevata && (
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-0.5">Kuladevata</p>
              <p className="text-gray-900">{family.kuladevata}</p>
            </div>
          )}
          {family.gotra && (
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-0.5">Gotra</p>
              <p className="text-gray-900">{family.gotra}</p>
            </div>
          )}
        </div>
        {family.description && (
          <p className="text-gray-600 text-sm mt-3 pt-3 border-t border-gray-100">{family.description}</p>
        )}
      </div>

      {(() => {
        const checks = [
          { label: 'Family photo', done: !!family.familyPhotoId },
          { label: 'Native village', done: !!family.nativeVillage },
          { label: 'Family description', done: !!family.description },
          { label: 'Current address', done: !!address },
        ]
        const pct = Math.round((checks.filter((c) => c.done).length / checks.length) * 100)
        if (pct === 100) return null
        return (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">Family Profile {pct}% Complete</h2>
              <Link href={`/family/${family.id}/edit`} className="text-xs text-saffron-600 font-medium hover:text-saffron-700">
                Complete Family Profile
              </Link>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-saffron-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-500">Missing: {checks.filter((c) => !c.done).map((c) => c.label).join(', ')}</p>
          </div>
        )
      })()}

      <div className="flex flex-wrap gap-3">
        <Link href={`/family/${family.id}/tree`} className="btn-primary flex items-center gap-2 text-sm">
          <TreePine className="w-4 h-4" /> View Family Tree
        </Link>
        <Link href={`/family/${family.id}/members/new`} className="btn-secondary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Add Member
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Family Members ({members.length})</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(({ member, isKarta }: { member: any; isKarta: boolean }) => {
            const age = calculateAge(member.dateOfBirth)
            const edu = member.education[0]
            return (
              <Link key={member.id} href={`/members/${member.id}`} className="card-hover block">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${
                    member.gender === 'MALE' ? 'bg-blue-500' : member.gender === 'FEMALE' ? 'bg-pink-500' : 'bg-gray-400'
                  }`}>
                    {member.firstName[0]}{member.lastName?.[0] ?? ''}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {member.firstName} {member.lastName ?? ''}
                      </p>
                      {isKarta && <span className="badge-orange text-xs shrink-0">Karta</span>}
                      {member.status === 'DECEASED' && <span className="badge-gray text-xs shrink-0">Deceased</span>}
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5 mt-0.5">
                      <div>{genderLabel(member.gender)} {age ? `· ${age} yrs` : ''}</div>
                      <div>{maritalLabel(member.maritalStatus)}</div>
                      {member.currentCity && <div className="truncate">{member.currentCity}</div>}
                      {edu && <div className="truncate">{edu.qualification ?? edu.level}</div>}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
          <Link href={`/family/${family.id}/members/new`}
            className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-saffron-300 hover:text-saffron-500 transition-colors group">
            <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Add Member</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
