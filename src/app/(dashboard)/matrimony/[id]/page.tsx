import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, GraduationCap, Briefcase, Ruler, Languages as LanguagesIcon } from 'lucide-react'
import { calculateAge, genderLabel, maritalLabel } from '@/lib/utils'
import SendInterestButton from '@/components/matrimony/SendInterestButton'

export default async function MatrimonyProfileDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const profile = await prisma.matrimonialProfile.findUnique({
    where: { id: params.id },
    include: {
      member: {
        include: {
          education: { where: { isHighest: true }, take: 1 },
          employment: { where: { isCurrent: true }, take: 1 },
          families: { include: { family: { select: { name: true, nativeVillage: true } } }, take: 1 },
        },
      },
      preferences: true,
    },
  })

  if (!profile || !profile.isVisible) notFound()

  const { member } = profile
  const age = calculateAge(member.dateOfBirth)
  const edu = member.education[0]
  const job = member.employment[0]
  const family = member.families[0]?.family
  const isOwn = (session.user as any).memberId === member.id

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link href="/matrimony" className="btn-ghost p-2 -ml-2 inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeft className="w-4 h-4" /> Back to Matrimony
      </Link>

      <div className="card">
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 ${
            member.gender === 'MALE' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
            member.gender === 'FEMALE' ? 'bg-gradient-to-br from-pink-400 to-pink-600' :
            'bg-gradient-to-br from-purple-400 to-purple-600'
          }`}>
            {member.firstName[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {member.firstName} {member.lastName?.[0] ? member.lastName[0] + '.' : ''}
            </h1>
            <p className="text-gray-500 text-sm">
              {genderLabel(member.gender)} · {age ? `${age} years` : 'Age not shared'} · {maritalLabel(member.maritalStatus)}
            </p>
            {family && <p className="text-gray-400 text-xs mt-0.5">{family.name} Family</p>}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
          {member.currentCity && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {member.currentCity}{member.currentState ? `, ${member.currentState}` : ''}
            </div>
          )}
          {edu && (
            <div className="flex items-center gap-2 text-gray-600">
              <GraduationCap className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {edu.qualification ?? edu.level}
            </div>
          )}
          {job && (
            <div className="flex items-center gap-2 text-gray-600">
              <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {job.designation ?? job.employmentType}
            </div>
          )}
          {profile.heightCm && (
            <div className="flex items-center gap-2 text-gray-600">
              <Ruler className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {profile.heightCm} cm
            </div>
          )}
          {profile.languages && profile.languages.length > 0 && (
            <div className="flex items-center gap-2 text-gray-600 sm:col-span-2">
              <LanguagesIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {profile.languages.join(', ')}
            </div>
          )}
        </div>

        {profile.about && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-1">About</p>
            <p className="text-sm text-gray-600 leading-relaxed">{profile.about}</p>
          </div>
        )}

        {!isOwn && (
          <div className="pt-4 border-t border-gray-100">
            <SendInterestButton toMemberId={member.id} />
          </div>
        )}
      </div>

      <div className="bg-pink-50 border border-pink-100 rounded-xl p-4 text-sm text-pink-700">
        Contact information is never shared directly. If your interest is accepted, the platform will
        facilitate the next step.
      </div>
    </div>
  )
}
