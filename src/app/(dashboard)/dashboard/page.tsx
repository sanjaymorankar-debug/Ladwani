import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  Users, Home, Heart, Bell, TreePine,
  ChevronRight, Calendar, MapPin
} from 'lucide-react'
import Link from 'next/link'
import { formatDate, calculateAge } from '@/lib/utils'

async function getDashboardData(userId: string) {
  const [user, recentPosts, stats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        member: {
          include: {
            families: { include: { family: true }, take: 1 },
            matrimonialProfile: { select: { isVisible: true } },
          },
        },
      },
    }),
    prisma.post.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        author: { select: { member: { select: { firstName: true, lastName: true } } } },
        postType: { select: { label: true, icon: true } },
      },
    }),
    prisma.$transaction([
      prisma.family.count({ where: { status: 'ACTIVE' } }),
      prisma.member.count({ where: { status: 'ACTIVE' } }),
      prisma.matrimonialProfile.count({ where: { isVisible: true } }),
    ]),
  ])

  return { user, recentPosts, stats }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const { user, recentPosts, stats } = await getDashboardData(session.user.id)
  const member = user?.member
  const family = member?.families[0]?.family

  const quickLinks = [
    { href: '/family', icon: Home, label: 'My Family', desc: family?.name ?? 'Set up your family', color: 'text-orange-600 bg-orange-50' },
    { href: family ? `/family/${family.id}/tree` : '/family', icon: TreePine, label: 'Family Tree', desc: 'View your family tree', color: 'text-green-600 bg-green-50' },
    { href: '/members', icon: Users, label: 'Directory', desc: 'Find community members', color: 'text-blue-600 bg-blue-50' },
    { href: '/matrimony', icon: Heart, label: 'Matrimony', desc: member?.matrimonialProfile?.isVisible ? 'Profile visible' : 'Set up profile', color: 'text-pink-600 bg-pink-50' },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-saffron-600 to-orange-500 rounded-2xl p-6 text-white shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-saffron-100 text-sm">Welcome back,</p>
            <h1 className="text-2xl font-bold mt-0.5 font-display">
              {member ? `${member.firstName} ${member.lastName ?? ''}`.trim() : session.user.name}
            </h1>
            {family && (
              <p className="text-saffron-100 text-sm mt-1 flex items-center gap-1">
                <Home className="w-3.5 h-3.5" /> {family.name}
              </p>
            )}
          </div>
          <div className="hidden sm:block">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold font-display">
              {member?.firstName?.[0] ?? '?'}
            </div>
          </div>
        </div>
      </div>

      {/* Community stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="stat-number">{stats[0].toLocaleString()}</div>
          <div className="stat-label">Families</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats[1].toLocaleString()}</div>
          <div className="stat-label">Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats[2].toLocaleString()}</div>
          <div className="stat-label">Matrimonial</div>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((l) => (
            <Link key={l.href} href={l.href} className="card-hover group">
              <div className={`w-10 h-10 ${l.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <l.icon className="w-5 h-5" />
              </div>
              <div className="font-semibold text-gray-900 text-sm">{l.label}</div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">{l.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Community feed */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Community Updates</h2>
            <Link href="/community" className="text-sm text-saffron-600 hover:text-saffron-700 flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentPosts.length === 0 ? (
              <div className="card text-center text-gray-500 py-10">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No community posts yet. Be the first to post!
              </div>
            ) : (
              recentPosts.map((post: any) => (
                <Link key={post.id} href={`/community/${post.id}`} className="card-hover block">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-saffron-100 rounded-lg flex items-center justify-center flex-shrink-0 text-sm">
                      {post.postType?.icon ?? '📌'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge-orange text-xs">{post.postType?.label}</span>
                        <span className="text-xs text-gray-400">{formatDate(post.createdAt, 'dd MMM')}</span>
                      </div>
                      {post.title && <p className="font-medium text-gray-900 text-sm truncate">{post.title}</p>}
                      {post.content && (
                        <p className="text-gray-600 text-xs mt-0.5 line-clamp-2">{post.content}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">My Profile</h2>
          <div className="card space-y-3">
            {!family && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800">No family linked</p>
                <p className="text-xs text-amber-700 mt-0.5 mb-2">Join or register your family to get started.</p>
                <Link href="/family/setup" className="text-xs font-medium text-amber-700 underline">
                  Set up family →
                </Link>
              </div>
            )}
            <div className="space-y-2 text-sm">
              {member?.currentCity && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {member.currentCity}
                  {member.currentState ? `, ${member.currentState}` : ''}
                </div>
              )}
              {member?.dateOfBirth && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  Age {calculateAge(member.dateOfBirth)}
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-gray-100">
              <Link href="/profile" className="btn-secondary text-sm w-full text-center block py-2">
                Complete Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
