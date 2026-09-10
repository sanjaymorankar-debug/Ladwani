import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Users, CheckCircle2, CalendarDays } from 'lucide-react'
import { formatPaise } from '@/lib/payments'
import { formatDate } from '@/lib/utils'
import BookingPanel from '@/components/assets/BookingPanel'
import AssetPhotoManager from '@/components/assets/AssetPhotoManager'

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const roles = ((session.user as any).roles ?? []) as string[]
  const memberId = (session.user as any).memberId as string | null
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')

  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true } },
      bookings: {
        where: { status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, endAt: { gte: new Date() } },
        select: { id: true, startAt: true, endAt: true, status: true, memberId: true },
        orderBy: { startAt: 'asc' },
      },
      blackouts: { where: { endAt: { gte: new Date() } }, orderBy: { startAt: 'asc' } },
    },
  })

  if (!asset || asset.deletedAt) notFound()

  const isOwner = memberId === asset.ownerMemberId
  const visible = asset.status === 'APPROVED' || isOwner || isStaff
  if (!visible) notFound()

  const bookable = asset.status === 'APPROVED' && asset.isActive && !isOwner
  // facilities is stored as a JSON column (see schema comment) — narrow it
  // back to a string array for display.
  const facilities = Array.isArray(asset.facilities) ? (asset.facilities as string[]) : []

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href="/assets" className="btn-ghost p-2 -ml-2 inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeft className="w-4 h-4" /> All assets
      </Link>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-5">
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 font-display">{asset.name}</h1>
                <p className="text-gray-500 text-sm mt-0.5">{asset.assetType}</p>
              </div>
              <span className={`badge text-xs ${asset.status === 'APPROVED' ? 'badge-green' : 'badge-orange'}`}>
                {asset.status === 'APPROVED' ? 'Approved' : asset.status === 'PENDING_APPROVAL' ? 'Awaiting approval' : asset.status}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
              {(asset.addressLine || asset.city) && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {[asset.addressLine, asset.city, asset.state].filter(Boolean).join(', ')}
                </div>
              )}
              {asset.capacity && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4 text-gray-400 flex-shrink-0" /> Capacity {asset.capacity}
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-900 font-medium">
                <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {asset.bookingMode === 'HOURLY'
                  ? `${formatPaise(asset.ratePerHour ?? 0)} per hour`
                  : `${formatPaise(asset.ratePerDay ?? 0)} per day`}
              </div>
              <div className="text-gray-500">
                Owner: {asset.owner.firstName} {asset.owner.lastName ?? ''}
              </div>
            </div>

            {facilities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">FACILITIES</p>
                <div className="flex flex-wrap gap-1.5">
                  {facilities.map((f) => (
                    <span key={f} className="badge bg-amber-50 text-amber-700 text-xs">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {asset.description && (
              <p className="text-sm text-gray-600 mt-4 pt-4 border-t border-gray-100">{asset.description}</p>
            )}
          </div>

          <AssetPhotoManager assetId={asset.id} canManage={isOwner || isStaff} />

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-saffron-600" /> Current bookings & availability
            </h2>
            {asset.bookings.length === 0 && asset.blackouts.length === 0 ? (
              <p className="text-sm text-green-600">Fully available — nothing booked yet.</p>
            ) : (
              <div className="space-y-2">
                {asset.bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
                    <span className="text-gray-700">
                      {formatDate(b.startAt, 'dd MMM yyyy')} → {formatDate(b.endAt, 'dd MMM yyyy')}
                    </span>
                    <span className={`badge text-xs ${b.status === 'CONFIRMED' ? 'badge-green' : 'badge-orange'}`}>
                      {b.status === 'CONFIRMED' ? 'Booked' : 'On hold'}
                    </span>
                  </div>
                ))}
                {asset.blackouts.map((bl, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
                    <span className="text-gray-700">
                      {formatDate(bl.startAt, 'dd MMM yyyy')} → {formatDate(bl.endAt, 'dd MMM yyyy')}
                    </span>
                    <span className="badge-gray text-xs">{bl.reason ?? 'Unavailable'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          {bookable ? (
            <BookingPanel
              assetId={asset.id}
              bookingMode={asset.bookingMode}
              ratePerDay={asset.ratePerDay}
              ratePerHour={asset.ratePerHour}
              capacity={asset.capacity}
            />
          ) : (
            <div className="card text-sm text-gray-500">
              {isOwner
                ? 'This is your asset — you cannot book it yourself.'
                : 'This asset is not open for booking yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
