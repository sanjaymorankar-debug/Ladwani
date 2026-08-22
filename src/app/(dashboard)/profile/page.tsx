import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Edit, Shield, Bell, Lock, User } from 'lucide-react'
import { calculateAge, genderLabel, maritalLabel, formatDate, GENDER_LABELS, MARITAL_STATUS_LABELS, getInitials } from '@/lib/utils'

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      member: {
        include: {
          education: { where: { isHighest: true }, take: 1 },
          employment: { where: { isCurrent: true }, take: 1 },
          skills: { include: { skill: { select: { name: true } } }, take: 6 },
          families: { include: { family: { select: { id: true, name: true } } }, take: 1 },
          matrimonialProfile: { select: { isVisible: true } },
          _count: { select: { relationshipsFrom: true } },
        },
      },
    },
  })

  const member = user?.member
  const family = member?.families[0]?.family
  const age = calculateAge(member?.dateOfBirth)
  const edu = member?.education[0]
  const job = member?.employment[0]

  const settingsLinks = [
    { href: '/members/' + (member?.id ?? '') + '/edit', icon: Edit, label: 'Edit Profile', desc: 'Update your personal information' },
    { href: '/profile/privacy', icon: Lock, label: 'Privacy Settings', desc: 'Control who sees your information' },
    { href: '/settings/notifications', icon: Bell, label: 'Notification Preferences', desc: 'Manage email and app notifications' },
    { href: '/settings/password', icon: Shield, label: 'Account Security', desc: 'Change password and security settings' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Profile header */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-2xl font-bold bg-gradient-to-br ${
            member?.gender === 'MALE' ? 'from-blue-400 to-blue-600' :
            member?.gender === 'FEMALE' ? 'from-pink-400 to-pink-600' :
            'from-saffron-400 to-saffron-600'
          }`}>
            {member ? getInitials(`${member.firstName} ${member.lastName ?? ''}`) : '?'}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 font-display">
              {member ? `${member.firstName} ${member.lastName ?? ''}` : session.user?.name ?? 'My Profile'}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">{user?.email ?? user?.mobile}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {member?.memberNumber && <span className="badge-orange">{member.memberNumber}</span>}
              {member && <span className="badge-blue">{genderLabel(member.gender)}</span>}
              {member && <span className="badge bg-pink-50 text-pink-700">{maritalLabel(member.maritalStatus)}</span>}
              {family && <span className="badge-gray">{family.name} Family</span>}
            </div>
            <div className="mt-3">
              {member ? (
                <Link href={`/members/${member.id}/edit`} className="btn-primary text-sm flex items-center gap-1.5 w-fit">
                  <Edit className="w-4 h-4" /> Edit Profile
                </Link>
              ) : (
                <Link href="/profile/setup" className="btn-primary text-sm">Complete Profile</Link>
              )}
            </div>
          </div>
        </div>

        {/* Info grid */}
        {member && (
          <div className="grid sm:grid-cols-2 gap-3 mt-5 pt-5 border-t border-gray-100 text-sm">
            {age && <div><span className="text-gray-500">Age</span> <span className="font-medium ml-2">{age} years</span></div>}
            {member.currentCity && <div><span className="text-gray-500">Location</span> <span className="font-medium ml-2">{member.currentCity}{member.currentState ? `, ${member.currentState}` : ''}</span></div>}
            {member.nativeVillage && <div><span className="text-gray-500">Native</span> <span className="font-medium ml-2">{member.nativeVillage}</span></div>}
            {edu && <div><span className="text-gray-500">Education</span> <span className="font-medium ml-2">{edu.qualification ?? edu.level}</span></div>}
            {job && <div><span className="text-gray-500">Work</span> <span className="font-medium ml-2">{job.designation ?? job.employmentType}</span></div>}
            {member?.matrimonialProfile && (
              <div><span className="text-gray-500">Matrimony</span> <span className={`font-medium ml-2 ${member.matrimonialProfile.isVisible ? 'text-green-600' : 'text-gray-400'}`}>
                {member.matrimonialProfile.isVisible ? '● Visible' : '○ Hidden'}
              </span></div>
            )}
          </div>
        )}

        {/* Skills */}
        {member?.skills && member.skills.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">SKILLS</p>
            <div className="flex flex-wrap gap-1.5">
              {member.skills.map(({ skill }: { skill: any }) => (
                <span key={skill.name} className="badge bg-amber-50 text-amber-700 text-xs">{skill.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings shortcuts */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Account Settings</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {settingsLinks.map((link) => (
            <Link key={link.href} href={link.href} className="card-hover flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <link.icon className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{link.label}</p>
                <p className="text-xs text-gray-500">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
