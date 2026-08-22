'use client'
import { useCallback, useEffect, useMemo } from 'react'
import ReactFlow, {
  Node, Edge, Controls, Background, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant,
  MarkerType, ConnectionLineType, Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Users, TreePine, Maximize2 } from 'lucide-react'
import { calculateAge } from '@/lib/utils'

// ── Tree layout (Sugiyama-inspired simple hierarchical) ──────────
function computeLayout(rawNodes: Node[], edges: Edge[]): Node[] {
  if (rawNodes.length === 0) return rawNodes

  // Build adjacency (parent → children via non-spouse edges)
  const children: Record<string, string[]> = {}
  const parents: Record<string, string[]> = {}
  rawNodes.forEach((n) => { children[n.id] = []; parents[n.id] = [] })

  edges.forEach((e) => {
    if (e.type !== 'spouse') {
      children[e.source]?.push(e.target)
      parents[e.target]?.push(e.source)
    }
  })

  // Find roots (nodes with no parents in tree)
  const roots = rawNodes
    .filter((n) => parents[n.id].length === 0)
    .map((n) => n.id)

  const W = 200 // node width + gap
  const H = 160 // row height

  const positions: Record<string, { x: number; y: number }> = {}
  const visited = new Set<string>()

  let globalX = 0
  function layoutSubtree(id: string, depth: number): number {
    if (visited.has(id)) return globalX
    visited.add(id)
    const kids = children[id].filter((k) => !visited.has(k))
    if (kids.length === 0) {
      positions[id] = { x: globalX * W, y: depth * H }
      globalX++
      return positions[id].x
    }
    const childXs = kids.map((k) => layoutSubtree(k, depth + 1))
    const cx = (childXs[0] + childXs[childXs.length - 1]) / 2
    positions[id] = { x: cx, y: depth * H }
    return cx
  }

  roots.forEach((r) => layoutSubtree(r, 0))

  // Position any unreachable nodes
  rawNodes.forEach((n) => {
    if (!positions[n.id]) {
      positions[n.id] = { x: globalX * W, y: 0 }
      globalX++
    }
  })

  return rawNodes.map((n) => ({ ...n, position: positions[n.id] }))
}

// ── Member Node Component ────────────────────────────────────────
function MemberNode({ data }: { data: any }) {
  const age = calculateAge(data.dateOfBirth)
  const isDeceased = data.status === 'DECEASED'
  const genderColor =
    data.gender === 'MALE' ? 'from-blue-400 to-blue-600' :
    data.gender === 'FEMALE' ? 'from-pink-400 to-pink-600' :
    'from-purple-400 to-purple-600'

  return (
    <div className={`
      node-card w-40 bg-white rounded-2xl shadow-md border-2 cursor-pointer
      transition-all duration-200 hover:shadow-lg hover:scale-105 select-none
      ${isDeceased ? 'border-gray-300 opacity-75' : 'border-white hover:border-saffron-300'}
      ${data.isKarta ? 'ring-2 ring-saffron-400 ring-offset-1' : ''}
    `}>
      {/* Avatar */}
      <div className={`
        h-1.5 rounded-t-2xl bg-gradient-to-r
        ${isDeceased ? 'from-gray-300 to-gray-400' : genderColor.replace('from-', 'from-').replace('to-', 'to-')}
      `} />
      <div className="p-3">
        <div className={`
          w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center
          text-white text-sm font-bold bg-gradient-to-br
          ${isDeceased ? 'from-gray-300 to-gray-400' : genderColor}
        `}>
          {data.firstName?.[0]}{data.lastName?.[0] ?? ''}
        </div>

        {data.isKarta && (
          <div className="text-center mb-1">
            <span className="text-[10px] font-bold text-saffron-600 bg-saffron-50 px-1.5 py-0.5 rounded-full">Karta</span>
          </div>
        )}

        <div className="text-center">
          <p className="text-xs font-semibold text-gray-900 leading-tight truncate">
            {data.firstName} {data.lastName ?? ''}
          </p>
          {age && <p className="text-[10px] text-gray-500 mt-0.5">{age} yrs</p>}
          {data.currentCity && (
            <p className="text-[10px] text-gray-400 truncate">{data.currentCity}</p>
          )}
          {isDeceased && (
            <span className="text-[10px] text-gray-400 italic">Deceased</span>
          )}
        </div>

        {/* Marital status dot */}
        <div className="flex justify-center mt-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${
            data.maritalStatus === 'MARRIED' ? 'bg-pink-400' :
            data.maritalStatus === 'WIDOWED' ? 'bg-gray-400' :
            'bg-green-400'
          }`} title={data.maritalStatus} />
        </div>
      </div>
    </div>
  )
}

const nodeTypes = { memberNode: MemberNode }

// ── Legend ───────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-xs space-y-1.5">
      <p className="font-semibold text-gray-700 mb-2">Legend</p>
      {[
        { color: 'bg-blue-500', label: 'Male' },
        { color: 'bg-pink-500', label: 'Female' },
        { color: 'bg-gray-400', label: 'Deceased' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <span className="text-gray-600">{label}</span>
        </div>
      ))}
      <hr className="my-1" />
      {[
        { style: 'border-t-2 border-orange-400 border-dashed', label: 'Spouse' },
        { style: 'border-t border-gray-400', label: 'Parent-Child' },
      ].map(({ style, label }) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`w-6 ${style}`} />
          <span className="text-gray-600">{label}</span>
        </div>
      ))}
      <hr className="my-1" />
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
        <span className="text-gray-600">Married</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        <span className="text-gray-600">Unmarried</span>
      </div>
    </div>
  )
}

// ── Main FamilyTree component ────────────────────────────────────
interface FamilyTreeProps {
  familyId: string
  familyName: string
  initialNodes: Node[]
  initialEdges: Edge[]
  onMemberClick?: (memberId: string) => void
}

export default function FamilyTree({
  familyId, familyName, initialNodes, initialEdges, onMemberClick
}: FamilyTreeProps) {
  const laidOutNodes = useMemo(
    () => computeLayout(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(laidOutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onNodeClick = useCallback((_: any, node: Node) => {
    onMemberClick?.(node.id)
  }, [onMemberClick])

  const processedEdges = useMemo(() => edges.map((e) => ({
    ...e,
    markerEnd: e.type !== 'spouse' ? { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 12, height: 12 } : undefined,
  })), [edges])

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={processedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="bg-white shadow-sm rounded-xl border border-gray-100" />
        <MiniMap
          nodeColor={(n) => {
            const g = n.data?.gender
            if (n.data?.status === 'DECEASED') return '#9ca3af'
            return g === 'MALE' ? '#60a5fa' : g === 'FEMALE' ? '#f472b6' : '#a78bfa'
          }}
          className="rounded-xl border border-gray-100 shadow-sm"
          pannable zoomable
        />
        <Panel position="top-left">
          <Legend />
        </Panel>
        <Panel position="top-right">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2 text-sm font-medium text-gray-700 flex items-center gap-2">
            <TreePine className="w-4 h-4 text-saffron-600" />
            {familyName} Family Tree
            <span className="text-xs text-gray-400">({nodes.length} members)</span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
