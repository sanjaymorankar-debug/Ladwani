import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Globe } from 'lucide-react'
import LocationMasterAdmin from '@/components/admin/LocationMasterAdmin'
import { isActiveAdmin } from '@/lib/scope'

export default async function AreasPage() {
  const session = await getServerSession(authOptions)
  if (!(await isActiveAdmin(session?.user?.id as string | undefined))) redirect('/dashboard')

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Globe className="w-5 h-5" /> Locations
        </h1>
        <p className="text-gray-500 text-sm">
          Location master: State › District › Taluka › Village / City. District and State entries are what
          Operators and District / State teams are mapped to.
        </p>
      </div>
      <LocationMasterAdmin />
    </div>
  )
}
