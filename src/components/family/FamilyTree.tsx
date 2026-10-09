'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Node, Edge, Controls, Background, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant,
  MarkerType, ConnectionLineType, Panel, Handle, Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { TreePine, Link2, ChevronDown, ChevronRight } from 'lucide-react'
import { layoutTree, descendantsOf, type LayoutEdge } from '@/lib/tree-layout'

// ── Member Node ─────────────────────────────────────────────────
function MemberNode({ data }: { data: any }) {
  const genderColor =
    data.gender === 'MALE' ? 'from-blue-400 to-blue-600' :
    data.gender === 'FEMALE' ? 'from-pink-400 to-pink-600' :
    'from-purple-400 to-purple-600'
  const color = data.late ? 'from-gray-300 to-gray-400' : genderColor

  return (
    <div className={`
      node-card w-40 bg-white rounded-2xl shadow-md border-2 cursor-pointer
      transition-all duration-200 hover:shadow-lg select-none
      ${data.selected ? 'border-saffron-400' : data.late ? 'border-gray-300' : 'border-white hover:border-saffron-300'}
      ${data.isKarta ? 'ring-2 ring-saffron-400 ring-offset-1' : ''}
    `}>
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className={`h-1.5 rounded-t-2xl bg-gradient-to-r ${color}`} />
      <div className="p-2.5">
        <div className={`w-9 h-9 rounded-xl mx-auto mb-1.5 flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br ${color}`}>
          {data.firstName?.[0]}{data.lastName?.[0] ?? ''}
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-gray-900 leading-tight truncate">
            {data.late && <span className="text-gray-500 font-normal">Late </span>}{data.firstName} {data.lastName ?? ''}
          </p>
          {data.role && <p className={`text-[10px] mt-0.5 ${data.isKarta ? 'font-bold text-saffron-600' : 'text-gray-500'}`}>{data.role}</p>}
          {data.birthYear && <p className="text-[10px] text-gray-400">b. {data.birthYear}</p>}
        </div>
        <div className="flex items-center justify-center gap-2 mt-1">
          {data.linkedFamilies?.length > 0 && (
            <span title={`Also in: ${data.linkedFamilies.map((f: any) => f.name).join(', ')}`} className="flex items-center gap-0.5 text-[10px] text-indigo-600">
              <Link2 className="w-3 h-3" />{data.linkedFamilies.length}
            </span>
          )}
          {data.hasChildren && (
            <button type="button" title={data.collapsed ? 'Expand' : 'Collapse'}
              onClick={(e) => { e.stopPropagation(); data.onToggle?.(data.id) }}
              className="text-gray-400 hover:text-saffron-600">
              {data.collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  )
}

const nodeTypes = { memberNode: MemberNode }

function Legend() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-xs space-y-1.5">
      <p className="font-semibold text-gray-700 mb-1">Legend</p>
      {[
        { color: 'bg-blue-500', label: 'Male' },
        { color: 'bg-pink-500', label: 'Female' },
        { color: 'bg-gray-400', label: 'Late' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <span className="text-gray-600">{label}</span>
        </div>
      ))}
      <hr className="my-1" />
      <div className="flex items-center gap-2"><div className="w-6 border-t-2 border-orange-400 border-dashed" /><span className="text-gray-600">Marriage</span></div>
      <div className="flex items-center gap-2"><div className="w-6 border-t border-gray-400" /><span className="text-gray-600">Parent → child</span></div>
      <div className="flex items-center gap-2"><Link2 className="w-3 h-3 text-indigo-600" /><span className="text-gray-600">Also in another family</span></div>
    </div>
  )
}

interface FamilyTreeProps {
  familyName: string
  initialNodes: Node[]
  initialEdges: (Edge & { kind: LayoutEdge['kind']; status?: string })[]
  selectedId?: string | null
  onMemberClick?: (memberId: string) => void
}

export default function FamilyTree({ familyName, initialNodes, initialEdges, selectedId, onMemberClick }: FamilyTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = useCallback((id: string) => setCollapsed((c) => {
    const n = new Set(c)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  }), [])

  const { shownNodes, shownEdges } = useMemo(() => {
    const hidden = new Set<string>()
    collapsed.forEach((id) => descendantsOf(id, initialEdges).forEach((d) => hidden.add(d)))
    const nodes = initialNodes.filter((n) => !hidden.has(n.id)).map((n) => ({
      ...n, data: { ...n.data, collapsed: collapsed.has(n.id), selected: n.id === selectedId, onToggle: toggle },
    }))
    const edges = initialEdges.filter((e) => !hidden.has(e.source) && !hidden.has(e.target))
    return { shownNodes: layoutTree(nodes as any, edges) as Node[], shownEdges: edges }
  }, [initialNodes, initialEdges, collapsed, selectedId, toggle])

  const [nodes, setNodes, onNodesChange] = useNodesState(shownNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(shownEdges)
  useEffect(() => { setNodes(shownNodes); setEdges(shownEdges) }, [shownNodes, shownEdges, setNodes, setEdges])

  const onNodeClick = useCallback((_: any, node: Node) => onMemberClick?.(node.id), [onMemberClick])

  const styled = useMemo(() => edges.map((e: any) => {
    if (e.kind === 'spouse') {
      const ended = e.status && e.status !== 'MARRIED'
      return { ...e, type: 'straight', style: { stroke: ended ? '#9ca3af' : '#f97316', strokeWidth: 2, strokeDasharray: '5 3' }, labelStyle: { fontSize: 9, fill: '#64748b' }, label: ended ? e.label : undefined }
    }
    if (e.kind === 'relation') {
      return { ...e, style: { stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '2 3' }, labelStyle: { fontSize: 9, fill: '#94a3b8' } }
    }
    return { ...e, style: { stroke: '#94a3b8', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 12, height: 12 } }
  }), [edges])

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={styled}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="bg-white shadow-sm rounded-xl border border-gray-100 print:hidden" />
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.late) return '#9ca3af'
            const g = n.data?.gender
            return g === 'MALE' ? '#60a5fa' : g === 'FEMALE' ? '#f472b6' : '#a78bfa'
          }}
          className="rounded-xl border border-gray-100 shadow-sm print:hidden"
          pannable zoomable
        />
        <Panel position="top-left"><Legend /></Panel>
        <Panel position="top-right">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-3 py-2 text-sm font-medium text-gray-700 flex items-center gap-2">
            <TreePine className="w-4 h-4 text-saffron-600" />
            {familyName} Family Tree
            <span className="text-xs text-gray-400">({nodes.length} shown)</span>
            {collapsed.size > 0 && (
              <button type="button" onClick={() => setCollapsed(new Set())} className="text-xs text-saffron-600 print:hidden">Expand all</button>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
