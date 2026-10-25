import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { json } from '@/lib/additional-details/http'
import { findBloodDonors } from '@/lib/community-connect'
import { BLOOD_GROUPS } from '@/lib/additional-details/sections'

/** Blood donor finder (rule 10): search by blood group AND city only; name + "request contact". */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return json({ message: 'Unauthorized' }, 401)
  const url = new URL(req.url)
  const bloodGroup = url.searchParams.get('bloodGroup') ?? ''
  const city = url.searchParams.get('city')?.trim() ?? ''
  if (!BLOOD_GROUPS.includes(bloodGroup)) return json({ message: 'Choose a blood group' }, 400)
  if (city.length < 2) return json({ message: 'Enter a city' }, 400)
  const donors = await findBloodDonors(bloodGroup, city, (session.user as any).memberId ?? null)
  return json({ donors })
}
