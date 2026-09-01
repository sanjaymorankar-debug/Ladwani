import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Settings2, Plus } from 'lucide-react'

export default async function RelationshipTypesPage() {
  const session = await getServerSession(authOptions)
  const roles = (session?.user as any)?.roles as string[] ?? []
  if (!roles.includes('ADMIN')) redirect('/dashboard')

  const types = await prisma.relationshipType.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] })

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Relationship Types
          </h1>
          <p className="text-gray-500 text-sm">Configure family relationship types and their inverses</p>
        </div>
        <button className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Type
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Code</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Label</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Inverse</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Gender</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Spouse?</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {types.map((rt: any) => (
              <tr key={rt.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{rt.code}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{rt.label}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{rt.inverseCode ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`badge text-xs ${
                    rt.genderApplicable === 'MALE' ? 'badge-blue' :
                    rt.genderApplicable === 'FEMALE' ? 'badge bg-pink-100 text-pink-700' :
                    'badge-gray'
                  }`}>{rt.genderApplicable ?? 'ANY'}</span>
                </td>
                <td className="px-4 py-3">
                  {rt.isSpouse ? <span className="badge bg-pink-100 text-pink-700 text-xs">Yes</span> : <span className="text-gray-400 text-xs">No</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`w-2 h-2 rounded-full inline-block ${rt.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
