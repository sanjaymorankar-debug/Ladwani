import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Users, Search, Filter, MapPin } from 'lucide-react'
import { calculateAge, genderLabel, maritalLabel } from '@/lib/utils'

export default async function MembersDirectoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const members = await prisma.member.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    include: {
      education: { where: { isHighest: true }, take: 1 },
      families: { include: { family: { select: { name: true } } }, take: 1 },
    },
    orderBy: { firstName: 'asc' },
    take: 50,
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Users className="w-6 h-6 text-saffron-600" /> Member Directory
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">{members.length} members in the directory</p>
      </div>

      {/* Search */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="search" placeholder="Search by name, city, occupation..." className="form-input pl-9" />
          </div>
          <select className="form-input w-auto">
            <option value="">All Genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
          <select className="form-input w-auto">
            <option value="">Marital Status</option>
            <option value="UNMARRIED">Unmarried</option>
            <option value="MARRIED">Married</option>
          </select>
          <button className="btn-primary flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4" /> Search
          </button>
        </div>
      </div>

      {/* Members grid */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {members.map((member: any) => {
          const age = calculateAge(member.dateOfBirth)
          const family = member.families[0]?.family
          const edu = member.education[0]
          return (
            <Link key={member.id} href={`/dashboard/members/${member.id}`} className="card-hover block text-center group">
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-xl font-bold font-display group-hover:scale-105 transition-transform ${
                member.gender === 'MALE' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                member.gender === 'FEMALE' ? 'bg-gradient-to-br from-pink-400 to-pink-600' :
                'bg-gradient-to-br from-gray-400 to-gray-500'
              }`}>
                {member.firstName[0]}{member.lastName?.[0] ?? ''}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">
                {member.firstName} {member.lastName ?? ''}
              </h3>
              {family && <p className="text-xs text-saffron-600 font-medium mt-0.5">{family.name} Family</p>}
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                <div>{genderLabel(member.gender)} {age ? `· ${age} yrs` : ''}</div>
                <div>{maritalLabel(member.maritalStatus)}</div>
                {member.currentCity && (
                  <div className="flex items-center justify-center gap-1">
                    <MapPin className="w-3 h-3" />{member.currentCity}
                  </div>
                )}
                {edu && <div className="truncate">{edu.qualification ?? edu.level}</div>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
