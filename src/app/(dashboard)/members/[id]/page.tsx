import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Calendar, Heart, GraduationCap,
  Briefcase, Phone, Mail, User, Edit, TreePine,
  Building2, Star, Users
} from 'lucide-react'
import { calculateAge, genderLabel, maritalLabel, formatDate, GENDER_LABELS, MARITAL_STATUS_LABELS, getInitials } from '@/lib/utils'
import { getMemberAccess } from '@/lib/member-auth'
import InviteToClaimPanel from '@/components/members/InviteToClaimPanel'
import MarkDeceasedPanel from '@/components/members/MarkDeceasedPanel'

export default async function MemberProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return null
  const viewerUserId = session.user?.id as string
  const viewerRoles: string[] = (session.user as any)?.roles ?? ['MEMBER']
  const isAdmin = viewerRoles.includes('ADMIN') || viewerRoles.includes('OPERATOR')

  const member = await prisma.member.findUnique({
    where: { id: params.id, deletedAt: null },
    include: {
      user: { select: { id: true, status: true } },
      families: {
        include: { family: { select: { id: true, name: true, registrationNumber: true, nativeVillage: true } } },
        take: 1,
      },
      education: { orderBy: [{ isHighest: 'desc' }, { yearCompleted: 'desc' }] },
      employment: { where: { isCurrent: true }, include: { incomeRange: { select: { label: true } } } },
      businesses: { where: { isActive: true } },
      skills: { include: { skill: true } },
      relationshipsFrom: {
        where: { isActive: true },
        include: { relationshipType: true, toMember: { select: { id: true, firstName: true, lastName: true, gender: true, status: true } } },
        take: 20,
      },
      matrimonialProfile: { select: { isVisible: true, about: true } },
    },
  })

  if (!member) notFound()

  const isOwnProfile = member.user?.id === viewerUserId
  const family = member.families[0]?.family
  const age = calculateAge(member.dateOfBirth)

  // Whoever maintains an account-less profile may invite the real person to
  // take it over (§12, §34). Re-derived server-side; the panel's own API
  // re-checks it too, so this only decides whether to render.
  const memberAccess = await getMemberAccess(session, params.id)
  const canInviteToClaim = !member.userId && memberAccess.authorized && !isOwnProfile

  const genderGrad = member.gender === 'MALE' ? 'from-blue-400 to-blue-600'
    : member.gender === 'FEMALE' ? 'from-pink-400 to-pink-600'
    : 'from-purple-400 to-purple-600'

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back nav */}
      <div className="flex items-center gap-2">
        <Link href="/members" className="btn-ghost p-2 -ml-2"><ArrowLeft className="w-4 h-4" /></Link>
        <span className="text-gray-400 text-sm">Member Directory</span>
      </div>

      {canInviteToClaim && (
        <InviteToClaimPanel
          memberId={member.id}
          memberName={member.firstName}
          defaultEmail={member.email}
        />
      )}

      {member.status === 'DECEASED' && (
        <div className="card bg-gray-50 text-sm text-gray-700">
          In loving memory{member.deceasedAt ? ` — passed away ${formatDate(member.deceasedAt)}` : ''}
          {member.deceasedPlace ? ` at ${member.deceasedPlace}` : ''}.
        </div>
      )}

      {memberAccess.authorized && !isOwnProfile && member.status !== 'DECEASED' && (
        <MarkDeceasedPanel memberId={member.id} memberName={member.firstName} />
      )}

      {/* Profile card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Avatar */}
          <div className={`w-24 h-24 rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-3xl font-bold bg-gradient-to-br ${genderGrad} shadow-sm`}>
            {getInitials(`${member.firstName} ${member.lastName ?? ''}`)}
          </div>

          {/* Basic info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 font-display">
                  {member.firstName} {member.middleName ? member.middleName + ' ' : ''}{member.lastName ?? ''}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="badge-orange">{member.memberNumber}</span>
                  <span className={`badge ${
                    member.status === 'ACTIVE' ? 'badge-green' :
                    member.status === 'DECEASED' ? 'badge-gray' : 'badge-red'
                  }`}>{member.status}</span>
                  <span className="badge-blue">{genderLabel(member.gender)}</span>
                  {member.maritalStatus !== 'NOT_STATED' && (
                    <span className="badge bg-pink-50 text-pink-700">{maritalLabel(member.maritalStatus)}</span>
                  )}
                </div>
              </div>
              {(isOwnProfile || isAdmin) && (
                <Link href={`/members/${member.id}/edit`} className="btn-secondary text-sm flex items-center gap-1.5 flex-shrink-0">
                  <Edit className="w-4 h-4" /> Edit Profile
                </Link>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">
              {age && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {age} years old {member.dateOfBirth ? `(${formatDate(member.dateOfBirth, 'dd MMM yyyy')})` : ''}
                </div>
              )}
              {member.currentCity && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {member.currentCity}{member.currentState ? `, ${member.currentState}` : ''}
                  {member.currentCountry && member.currentCountry !== 'India' ? `, ${member.currentCountry}` : ''}
                </div>
              )}
              {member.nativeVillage && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  Native: {member.nativeVillage}{member.nativeState ? `, ${member.nativeState}` : ''}
                </div>
              )}
              {family && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <Link href={`/family/${family.id}`} className="hover:text-saffron-600 font-medium">
                    {family.name} Family
                  </Link>
                </div>
              )}
              {(isOwnProfile || isAdmin) && member.mobilePrimary && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {member.mobilePrimary}
                </div>
              )}
              {(isOwnProfile || isAdmin) && member.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {member.email}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Biography */}
        {member.biography && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600 leading-relaxed">{member.biography}</p>
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2 flex-wrap">
          {family && (
            <Link href={`/family/${family.id}/tree`} className="btn-ghost text-sm flex items-center gap-1.5">
              <TreePine className="w-4 h-4" /> View Family Tree
            </Link>
          )}
          {member.matrimonialProfile?.isVisible && !isOwnProfile && (
            <Link href={`/matrimony/${params.id}`} className="btn-ghost text-sm flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-pink-500" /> Matrimonial Profile
            </Link>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Education */}
        {member.education.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <GraduationCap className="w-4 h-4 text-blue-600" /> Education
            </h2>
            <div className="space-y-3">
              {member.education.map((edu: any) => (
                <div key={edu.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm">
                      {edu.qualification ?? edu.level}
                      {edu.isHighest && <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">Highest</span>}
                    </p>
                    {edu.specialization && <p className="text-xs text-gray-500">{edu.specialization}</p>}
                    {edu.institution && <p className="text-xs text-gray-400">{edu.institution}</p>}
                    {edu.yearCompleted && <p className="text-xs text-gray-400">Completed {edu.yearCompleted}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employment */}
        {(member.employment.length > 0 || member.businesses.length > 0) && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4 text-green-600" /> Work
            </h2>
            <div className="space-y-3">
              {member.employment.map((emp: any) => (
                <div key={emp.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{emp.designation ?? emp.employmentType}</p>
                    {emp.employerName && <p className="text-xs text-gray-500">{emp.employerName}</p>}
                    {emp.industry && <p className="text-xs text-gray-400">{emp.industry}</p>}
                    {emp.city && <p className="text-xs text-gray-400">{emp.city}</p>}
                    {emp.incomeRange && (
                      <p className="text-xs text-gray-400">{emp.incomeRange.label}</p>
                    )}
                  </div>
                </div>
              ))}
              {member.businesses.map((biz: any) => (
                <div key={biz.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{biz.businessName ?? 'Business'}</p>
                    {biz.businessType && <p className="text-xs text-gray-500">{biz.businessType}</p>}
                    {biz.industry && <p className="text-xs text-gray-400">{biz.industry}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {member.skills.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-amber-500" /> Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {member.skills.map(({ skill, level }: { skill: any; level: string | null }) => (
                <span key={skill.id} className="badge bg-amber-50 text-amber-800 text-xs px-2.5 py-1">
                  {skill.name}
                  {level && <span className="ml-1 text-amber-500">· {level.toLowerCase()}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Family Relationships */}
        {member.relationshipsFrom.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-saffron-600" /> Family Connections
            </h2>
            <div className="space-y-2">
              {member.relationshipsFrom.slice(0, 8).map((rel: any) => (
                <div key={rel.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      rel.toMember.gender === 'MALE' ? 'bg-blue-400' : 'bg-pink-400'
                    }`}>
                      {rel.toMember.firstName[0]}
                    </div>
                    <Link href={`/members/${rel.toMember.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-saffron-600">
                      {rel.toMember.firstName} {rel.toMember.lastName ?? ''}
                    </Link>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                    {rel.relationshipType.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
