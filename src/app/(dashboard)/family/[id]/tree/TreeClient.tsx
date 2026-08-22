'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Printer, Users, ZoomIn } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

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
  memberCount: number
}

export default function FamilyTreeClient({ familyId, familyName, nodes, edges, memberCount }: Props) {
  const router = useRouter()
  const [selectedMember, setSelectedMember] = useState<string | null>(null)

  const handleMemberClick = useCallback((memberId: string) => {
    router.push(`/members/${memberId}`)
  }, [router])

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Link href="/family" className="btn-ghost p-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="font-bold text-gray-900 text-sm leading-tight">{familyName} — Family Tree</h1>
          <p className="text-xs text-gray-500">{memberCount} members · Click any member to view profile</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
            <ZoomIn className="w-3.5 h-3.5" />
            Scroll to zoom · Drag to pan
          </div>
          <button
            onClick={() => window.print()}
            className="btn-ghost text-sm flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <Link
            href={`/family/${familyId}/members/new`}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Users className="w-4 h-4" /> Add Member
          </Link>
        </div>
      </div>

      {/* Tree canvas */}
      <div className="flex-1 bg-gray-50">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 bg-saffron-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-saffron-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">No members yet</h3>
              <p className="text-gray-500 text-sm mb-4">Add family members to see the tree.</p>
              <Link href={`/family/${familyId}/members/new`} className="btn-primary text-sm">
                Add First Member
              </Link>
            </div>
          </div>
        ) : (
          <FamilyTree
            familyId={familyId}
            familyName={familyName}
            initialNodes={nodes}
            initialEdges={edges}
            onMemberClick={handleMemberClick}
          />
        )}
      </div>
    </div>
  )
}
