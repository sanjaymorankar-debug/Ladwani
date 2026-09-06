import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Building2, MapPin, Users, IndianRupee, Plus, CheckCircle2, Clock } from 'lucide-react'
import { formatPaise } from '@/lib/payments'

export default async function AssetsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const roles = ((session.user as any).roles ?? []) as string[]
  const memberId = (session.user as any).memberId as string | null
  const canOwnAssets = roles.includes('ASSET_OWNER') || roles.includes('ADMIN') || roles.includes('OPERATOR')

  const [assets, myAssets] = await Promise.all([
    prisma.asset.findMany({
      where: { status: 'APPROVED', isActive: true, deletedAt: null },
      include: {
        owner: { select: { firstName: true, lastName: true } },
        bookings: {
          where: { status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, endAt: { gte: new Date() } },
          select: { startAt: true, endAt: true },
          orderBy: { startAt: 'asc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    memberId
      ? prisma.asset.findMany({
          where: { ownerMemberId: memberId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        })
      : [],
  ])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <Building2 className="w-6 h-6 text-saffron-600" /> Community Assets
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Halls, guesthouses and equipment you can book</p>
        </div>
        {canOwnAssets && (
          <Link href="/assets/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Register an Asset
          </Link>
        )}
      </div>

      {myAssets.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">My Assets</h2>
          <div className="space-y-2">
            {myAssets.map((a) => (
              <div key={a.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.assetType} · {a.city ?? 'Location not set'}</p>
                </div>
                <span className={`badge text-xs ${
                  a.status === 'APPROVED' ? 'badge-green'
                    : a.status === 'PENDING_APPROVAL' ? 'badge-orange'
                    : 'badge-gray'
                }`}>
                  {a.status === 'PENDING_APPROVAL' ? 'Awaiting approval' : a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {assets.length === 0 ? (
        <div className="card text-center py-16">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No community assets are available yet.</p>
          {canOwnAssets && (
            <Link href="/assets/new" className="text-saffron-600 text-sm font-medium mt-2 inline-block hover:text-saffron-700">
              Register the first one →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {assets.map((a) => (
            <Link key={a.id} href={`/assets/${a.id}`} className="card-hover block">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">{a.name}</h3>
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              </div>
              <p className="text-xs text-gray-500 mb-3">{a.assetType}</p>

              <div className="space-y-1.5 text-sm text-gray-600">
                {a.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" /> {a.city}
                  </div>
                )}
                {a.capacity && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400 flex-shrink-0" /> Up to {a.capacity} guests
                  </div>
                )}
                <div className="flex items-center gap-2 font-medium text-gray-900">
                  <IndianRupee className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {a.bookingMode === 'HOURLY'
                    ? `${formatPaise(a.ratePerHour ?? 0)} / hour`
                    : `${formatPaise(a.ratePerDay ?? 0)} / day`}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                {a.bookings.length === 0 ? (
                  <span className="text-green-600">Available — no upcoming bookings</span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {a.bookings.length} upcoming booking{a.bookings.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
