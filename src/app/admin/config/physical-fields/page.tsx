import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Ruler } from 'lucide-react'
import PhysicalFieldsAdmin from '@/components/admin/PhysicalFieldsAdmin'

export default async function PhysicalFieldsConfigPage() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN')) redirect('/dashboard')

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Ruler className="w-5 h-5" /> Physical Detail Fields
        </h1>
        <p className="text-gray-500 text-sm">Choose which optional physical fields members are asked for. Turned-off fields are hidden and not accepted.</p>
      </div>
      <PhysicalFieldsAdmin />
    </div>
  )
}
