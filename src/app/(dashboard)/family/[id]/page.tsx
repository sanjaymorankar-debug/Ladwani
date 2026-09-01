import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, TreePine, Users, CheckCircle2, Home, Calendar } from 'lucide-react'
import { formatDate, calculateAge, GENDER_LABELS, MARITAL_STATUS_LABELS } from '@/lib/utils'

export default async function FamilyDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return null

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
          <div className="w-20 h-20 bg-gradient-to-br from-saffron-400 to-saffron-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-sm flex-shrink-0">
            {family.name[0]}
          </div>
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
              <Link href={`/family/${family.id}/tree`} className="btn-secondary text-sm flex items-center gap-1.5 flex-shrink-0">
                <TreePine className="w-4 h-4" /> View Tree
              </Link>
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

      {/* Members */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Family Members</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {family.members.map(({ member, isKarta }: any) => {
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
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {member.firstName} {member.lastName ?? ''}
                      </p>
                      {isKarta && <span className="badge-orange text-xs shrink-0">Karta</span>}
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5 mt-0.5">
                      <div>{GENDER_LABELS[member.gender as keyof typeof GENDER_LABELS] ?? member.gender} {age ? `· ${age} yrs` : ''}</div>
                      <div>{MARITAL_STATUS_LABELS[member.maritalStatus as keyof typeof MARITAL_STATUS_LABELS] ?? member.maritalStatus}</div>
                      {member.currentCity && <div>{member.currentCity}</div>}
                      {edu && <div className="truncate">{edu.qualification ?? edu.level}</div>}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
