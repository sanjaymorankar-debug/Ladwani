'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Users, ZoomIn, X, Link2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import TreeBuilderActions from '@/components/family/TreeBuilderActions'

// Load ReactFlow dynamically to avoid SSR issues
const FamilyTree = dynamic(() => import('@/components/family/FamilyTree'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-saffron-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading family tree...</p>
      </div>
    </div>
  ),
})

interface Props {
  familyId: string
  familyName: string
  nodes: any[]
  edges: any[]
  mode: 'FULL' | 'BRANCH'
  canEdit: boolean
  isMember: boolean
}

/**
 * F25 — zoom / pan, collapse a branch, click a person for their card,
 * jump to the other families they belong to, print or save as PDF.
 * Members of a linked family see only the connecting branch.
 */
export default function FamilyTreeClient({ familyId, familyName, nodes, edges, mode, canEdit, isMember }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = nodes.find((n) => n.id === selectedId)?.data
  const onMemberClick = useCallback((memberId: string) => setSelectedId(memberId), [])

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col print:h-auto">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 print:hidden">
        <Link href={`/family?f=${familyId}`} className="btn-ghost p-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-bold text-gray-900 text-sm leading-tight">{familyName} — Family Tree</h1>
          <p className="text-xs text-gray-500">
            {mode === 'BRANCH' ? 'Linked family — only the branch connecting to your family is shown' : `${nodes.length} people · Click anyone for their card`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
            <ZoomIn className="w-3.5 h-3.5" /> Scroll to zoom · Drag to pan
          </div>
          <button onClick={() => window.print()} className="btn-ghost text-sm flex items-center gap-1.5" title="Print, or choose “Save as PDF” in the print dialog">
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
          {canEdit && (
            <Link href={`/family/${familyId}/members/new`} className="btn-primary text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Add Member
            </Link>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 bg-gray-50 print:bg-white">
          {nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">No members yet</h3>
                <p className="text-gray-500 text-sm">Add family members to see the tree.</p>
              </div>
            </div>
          ) : (
            <FamilyTree familyName={familyName} initialNodes={nodes} initialEdges={edges} selectedId={selectedId} onMemberClick={onMemberClick} />
          )}
        </div>

        {selected && (
          <aside className="w-80 bg-white border-l border-gray-100 p-4 overflow-y-auto space-y-3 print:hidden">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">{selected.late ? 'Late ' : ''}{selected.firstName} {selected.lastName}</h2>
                <p className="text-sm text-gray-500">{selected.role ?? 'Member'}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <dl className="text-sm space-y-1">
              {selected.birthYear && <div><dt className="inline text-gray-500">Born: </dt><dd className="inline">{selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString('en-IN') : selected.birthYear}</dd></div>}
              {selected.currentCity && <div><dt className="inline text-gray-500">Lives in: </dt><dd className="inline">{selected.currentCity}</dd></div>}
              {selected.late && <div className="text-gray-500 italic">Expired</div>}
            </dl>
            {selected.linkedFamilies?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Also in</p>
                {selected.linkedFamilies.map((f: any) => (
                  <Link key={f.id} href={`/family/${f.id}/tree`} className="flex items-center gap-1.5 text-sm text-indigo-700 hover:underline">
                    <Link2 className="w-3.5 h-3.5" /> {f.name} family tree
                  </Link>
                ))}
              </div>
            )}
            {mode === 'FULL' && (
              <Link href={`/members/${selected.id}`} className="btn-secondary text-sm w-full flex items-center justify-center gap-1.5">
                <ExternalLink className="w-4 h-4" /> Open profile
              </Link>
            )}
            {mode === 'FULL' && isMember && (
              <TreeBuilderActions familyId={familyId} person={selected} onChanged={() => router.refresh()} />
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
