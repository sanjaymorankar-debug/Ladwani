import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { canBrowse } from '@/lib/bureau'
import BureauBrowser from '@/components/matrimony/BureauBrowser'
import InterestsPanel from '@/components/matrimony/InterestsPanel'

/** F37 / F38 marriage bureau: my listing, my interests, and search (limited cards, no contact details). */
export default async function MatrimonyPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { member: { select: { matrimonialProfile: { select: { isVisible: true } } } } } })
  const myProfile = me?.member?.matrimonialProfile
  const browse = await canBrowse(session)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <Heart className="w-6 h-6 text-pink-500" /> Marriage Bureau
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Contact details are shared only when both sides accept.</p>
        </div>
        {!myProfile ? (
          <Link href="/matrimony/create-profile" className="btn-primary flex items-center gap-2 text-sm"><Heart className="w-4 h-4" /> Create My Profile</Link>
        ) : (
          <Link href="/matrimony/my-profile" className="btn-secondary flex items-center gap-2 text-sm"><Heart className="w-4 h-4" /> {myProfile.isVisible ? 'My Profile (Listed)' : 'My Profile (Not listed)'}</Link>
        )}
      </div>
      <InterestsPanel />
      {browse ? <BureauBrowser /> : (
        <div className="card text-sm text-gray-600">Only members listed in the marriage bureau, and their Karta, can browse it. Create your profile and turn it on to search.</div>
      )}
    </div>
  )
}
