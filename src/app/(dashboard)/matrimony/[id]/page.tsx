import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, GraduationCap, Briefcase, Ruler,
  Languages, Building2, Heart, EyeOff
} from 'lucide-react'
import { calculateAge, genderLabel, maritalLabel, getInitials } from '@/lib/utils'
import SendInterestButton from '@/components/matrimony/SendInterestButton'

export default async function MatrimonialProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const profile = await prisma.matrimonialProfile.findUnique({
    where: { id: params.id },
    include: {
      member: {
        include: {
          education: { where: { isHighest: true }, take: 1 },
          employment: { where: { isCurrent: true }, take: 1, include: { incomeRange: { select: { label: true } } } },
          families: { include: { family: { select: { name: true, nativeVillage: true, nativeState: true } } }, take: 1 },
        },
      },
      preferences: true,
    },
  })

  if (!profile) notFound()

  const isOwner = profile.member.userId === session.user.id
  if (!profile.isVisible && !isOwner) notFound()

  const { member } = profile
  const age = calculateAge(member.dateOfBirth)
  const edu = member.education[0]
  const job = member.employment[0]
  const family = member.families[0]?.family
  const languages = Array.isArray(profile.languages) ? (profile.languages as string[]) : []
  const preferredLocations = Array.isArray(profile.preferences?.preferredLocations)
    ? (profile.preferences!.preferredLocations as string[])
    : []

  const genderGrad = member.gender === 'MALE' ? 'from-blue-400 to-blue-600'
    : member.gender === 'FEMALE' ? 'from-pink-400 to-pink-600'
    : 'from-purple-400 to-purple-600'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/matrimony" className="btn-ghost p-2 -ml-2"><ArrowLeft className="w-4 h-4" /></Link>
        <span className="text-gray-400 text-sm">Community Matrimony</span>
      </div>

      {!profile.isVisible && isOwner && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 text-sm text-gray-600">
          <EyeOff className="w-4 h-4 flex-shrink-0" /> This profile is currently hidden from matrimony search. Only you can see this page.
        </div>
      )}

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-2xl font-bold font-display bg-gradient-to-br ${genderGrad} shadow-sm`}>
            {getInitials(`${member.firstName} ${member.lastName?.[0] ?? ''}`)}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 font-display">
              {member.firstName} {member.lastName?.[0] ? member.lastName[0] + '.' : ''}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="badge-blue">{genderLabel(member.gender)}</span>
              {age && <span className="badge bg-gray-100 text-gray-700">{age} years</span>}
              {member.maritalStatus !== 'NOT_STATED' && (
                <span className="badge bg-pink-50 text-pink-700">{maritalLabel(member.maritalStatus)}</span>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">
              {member.currentCity && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {member.currentCity}{member.currentState ? `, ${member.currentState}` : ''}
                </div>
              )}
              {family && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {family.name} Family{family.nativeVillage ? ` · ${family.nativeVillage}` : ''}
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
              {languages.length > 0 && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Languages className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {languages.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>

        {profile.about && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">About</p>
            <p className="text-sm text-gray-700 leading-relaxed">{profile.about}</p>
          </div>
        )}

        {!isOwner && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <SendInterestButton toMemberId={member.id} className="btn-primary text-sm py-2.5 px-6 flex items-center gap-1.5" />
          </div>
        )}
      </div>

      {preferredLocations.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-pink-500" /> Partner Preferences
          </h2>
          <div className="flex flex-wrap gap-2">
            {preferredLocations.map((loc) => (
              <span key={loc} className="badge bg-pink-50 text-pink-700 text-xs">{loc}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card bg-pink-50 border-pink-100">
        <p className="text-sm text-pink-900 leading-relaxed">
          Contact information is never shared directly. If your interest is accepted, the platform will help connect your families.
        </p>
      </div>
    </div>
  )
}
