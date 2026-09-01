import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Settings2 } from 'lucide-react'
import RelationshipTypesTable from '@/components/admin/RelationshipTypesTable'

export default async function RelationshipTypesPage() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN')) redirect('/dashboard')

  const types = await prisma.relationshipType.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] })

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Settings2 className="w-5 h-5" /> Relationship Types
        </h1>
        <p className="text-gray-500 text-sm">Configure family relationship types and their inverses</p>
      </div>

      <RelationshipTypesTable initialTypes={types} />
    </div>
  )
}
