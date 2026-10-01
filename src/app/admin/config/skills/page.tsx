import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import SkillsAdmin from '@/components/admin/SkillsAdmin'

export default async function SkillsConfigPage() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) redirect('/dashboard')

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> Skills
        </h1>
        <p className="text-gray-500 text-sm">The master list members pick from. Members can still add a skill that is not listed.</p>
      </div>
      <SkillsAdmin />
    </div>
  )
}
