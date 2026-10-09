import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ListChecks } from 'lucide-react'
import OptionsAdmin from '@/components/admin/OptionsAdmin'

export default async function OptionsConfigPage() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN')) redirect('/admin')

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2"><ListChecks className="w-5 h-5" /> Additional Details dropdowns</h1>
        <p className="text-gray-500 text-sm">Edit the choices members see. Amounts must stay as ranges (bands), never exact figures. Removing an option hides it from the form; answers already saved keep their label.</p>
      </div>
      <OptionsAdmin />
    </div>
  )
}
