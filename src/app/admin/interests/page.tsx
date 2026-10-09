import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import InterestsAdmin from '@/components/admin/InterestsAdmin'

export default async function InterestsAdminPage() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN')) redirect('/admin')

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2"><Sparkles className="w-5 h-5" /> Hobby master</h1>
        <p className="text-gray-500 text-sm">
          Every approved hobby has a community interest group. Members’ “Other” hobbies wait here: approve them (the group is created and everyone who picked it is added),
          merge them into an existing hobby to avoid duplicate or misspelt groups, or reject them. “Child-safe” lets members under 18 be added.
        </p>
      </div>
      <InterestsAdmin />
    </div>
  )
}
