import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Heart, Search, Filter, MapPin, GraduationCap, Briefcase } from 'lucide-react'
import { calculateAge, genderLabel, maritalLabel, GENDER_LABELS } from '@/lib/utils'
import SendInterestButton from '@/components/matrimony/SendInterestButton'

export default async function MatrimonyPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const [profiles, currentMember] = await Promise.all([
    prisma.matrimonialProfile.findMany({
      where: { isVisible: true },
      include: {
        member: {
          include: {
            education: { where: { isHighest: true }, take: 1 },
            employment: { where: { isCurrent: true }, take: 1 },
          },
        },
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { member: { include: { matrimonialProfile: true } } },
    }),
  ])

  const myProfile = currentMember?.member?.matrimonialProfile

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <Heart className="w-6 h-6 text-pink-500" /> Community Matrimony
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Trusted matrimonial discovery within Ladwani Samaj
          </p>
        </div>
        <div className="flex gap-3">
          {!myProfile ? (
            <Link href="/matrimony/create-profile" className="btn-primary flex items-center gap-2 text-sm">
              <Heart className="w-4 h-4" /> Create My Profile
            </Link>
          ) : (
            <Link href="/matrimony/my-profile" className="btn-secondary flex items-center gap-2 text-sm">
              <Heart className="w-4 h-4" /> {myProfile.isVisible ? 'My Profile (Visible)' : 'My Profile (Hidden)'}
            </Link>
          )}
        </div>
      </div>

      {/* Privacy notice */}
      <div className="bg-pink-50 border border-pink-100 rounded-xl p-4 flex gap-3">
        <Heart className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-pink-900">Privacy-First Matrimony</p>
          <p className="text-pink-700 mt-0.5">
            Contact information is never shared directly. Interested families connect through our platform.
            Only members who have opted in appear here.
          </p>
        </div>
      </div>

      {/* Search filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="search" placeholder="Search by name, city, education..."
                className="form-input pl-9" />
            </div>
          </div>
          <select className="form-input w-auto">
            <option value="">Any Gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
          <select className="form-input w-auto">
            <option value="">Any Age</option>
            <option value="18-25">18–25</option>
            <option value="25-30">25–30</option>
            <option value="30-35">30–35</option>
            <option value="35-45">35–45</option>
          </select>
          <select className="form-input w-auto">
            <option value="">Any Location</option>
            <option value="maharashtra">Maharashtra</option>
            <option value="gujarat">Gujarat</option>
            <option value="delhi">Delhi</option>
          </select>
          <button className="btn-primary flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
      </div>

      {/* Profiles grid */}
      {profiles.length === 0 ? (
        <div className="card text-center py-16">
          <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No matrimonial profiles available yet.</p>
          <p className="text-gray-400 text-sm mt-1">Be the first to create a profile!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {profiles.map((profile: any) => {
            const { member } = profile
            const age = calculateAge(member.dateOfBirth)
            const edu = member.education[0]
            const job = member.employment[0]

            return (
              <div key={profile.id} className="card-hover">
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold font-display flex-shrink-0 ${
                    member.gender === 'MALE' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                    member.gender === 'FEMALE' ? 'bg-gradient-to-br from-pink-400 to-pink-600' :
                    'bg-gradient-to-br from-purple-400 to-purple-600'
                  }`}>
                    {member.firstName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {member.firstName} {member.lastName?.[0] ? member.lastName[0] + '.' : ''}
                    </h3>
                    <div className="text-sm text-gray-500">
                      {genderLabel(member.gender)} · {age ? `${age} years` : 'Age not shared'}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm mb-4">
                  {member.currentCity && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      {member.currentCity}{member.currentState ? `, ${member.currentState}` : ''}
                    </div>
                  )}
                  {edu && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <GraduationCap className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{edu.qualification ?? edu.level}</span>
                    </div>
                  )}
                  {job && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{job.designation ?? job.employmentType}</span>
                    </div>
                  )}
                </div>

                {profile.about && (
                  <p className="text-xs text-gray-500 mb-4 line-clamp-2">{profile.about}</p>
                )}

                <div className="flex gap-2">
                  <Link href={`/matrimony/${profile.id}`}
                    className="flex-1 btn-secondary text-sm text-center py-2">
                    View Profile
                  </Link>
                  <SendInterestButton toMemberId={member.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
