/**
 * F25 tree layout (pure, client-safe). One row per generation, ancestors on
 * top; children are placed under their parents and spouses side by side.
 */
export interface LayoutNode { id: string; data: { generation: number; firstName?: string } }
export interface LayoutEdge { source: string; target: string; kind: 'parent' | 'spouse' | 'relation' }

export const NODE_W = 190
export const ROW_H = 170

export function layoutTree<N extends LayoutNode>(nodes: N[], edges: LayoutEdge[]): (N & { position: { x: number; y: number } })[] {
  if (!nodes.length) return []
  const ids = new Set(nodes.map((n) => n.id))
  const parents = new Map<string, string[]>()
  const children = new Map<string, string[]>()
  const spouses = new Map<string, string[]>()
  const anchors = new Map<string, string[]>() // relation edges: hang a person off their relative
  const push = (m: Map<string, string[]>, k: string, v: string) => { if (!m.has(k)) m.set(k, []); m.get(k)!.push(v) }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue
    if (e.kind === 'parent') { push(parents, e.target, e.source); push(children, e.source, e.target) }
    if (e.kind === 'spouse') { push(spouses, e.source, e.target); push(spouses, e.target, e.source) }
    if (e.kind === 'relation') push(anchors, e.target, e.source)
  }

  const gens = Array.from(new Set(nodes.map((n) => n.data.generation))).sort((a, b) => b - a)
  const rows = gens.map((g) => nodes.filter((n) => n.data.generation === g).map((n) => n.id))
  const x = new Map<string, number>()
  const avg = (list: string[] | undefined) => {
    const xs = (list ?? []).filter((id) => x.has(id)).map((id) => x.get(id)!)
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  }

  const place = (row: string[], key: (id: string) => number | null) => {
    const wanted = new Map(row.map((id, i) => [id, key(id) ?? (x.has(id) ? x.get(id)! : i * NODE_W)]))
    // Someone with no parents or children here (typically a spouse who married
    // in) goes right next to their partner rather than where they happened to be.
    for (const id of row) {
      if (parents.has(id) || children.has(id)) continue
      const partner = (spouses.get(id) ?? []).find((s) => row.includes(s) && (parents.has(s) || children.has(s)))
      if (partner) wanted.set(id, wanted.get(partner)! + 0.5)
    }
    const sorted = [...row].sort((a, b) => wanted.get(a)! - wanted.get(b)! || a.localeCompare(b))
    // Spouses side by side: pull each partner right after the first of the pair.
    const ordered: string[] = []
    for (const id of sorted) {
      if (ordered.includes(id)) continue
      ordered.push(id)
      for (const s of spouses.get(id) ?? []) if (row.includes(s) && !ordered.includes(s)) ordered.push(s)
    }
    let last = -Infinity
    for (const id of ordered) {
      const pos = Math.max(wanted.get(id)!, last + NODE_W)
      x.set(id, pos)
      last = pos
    }
    return ordered
  }

  // Top-down: under parents (or the relative they hang from, or their spouse).
  for (let pass = 0; pass < 2; pass++) {
    rows.forEach((row, i) => {
      rows[i] = place(row, (id) => avg(parents.get(id)) ?? avg(anchors.get(id)) ?? avg((spouses.get(id) ?? []).filter((s) => x.has(s) && s !== id)))
    })
    // Bottom-up: parents centred over their children.
    for (let i = rows.length - 2; i >= 0; i--) {
      rows[i] = place(rows[i], (id) => avg(children.get(id)) ?? (x.has(id) ? x.get(id)! : null))
    }
  }

  const minX = Math.min(...Array.from(x.values()))
  return nodes.map((n) => ({
    ...n,
    position: { x: (x.get(n.id) ?? 0) - minX, y: gens.indexOf(n.data.generation) * ROW_H },
  }))
}

/** Everyone below `id` (children, their children…) and the spouses who hang only off them. */
export function descendantsOf(id: string, edges: LayoutEdge[]) {
  const out = new Set<string>()
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const e of edges) {
      if (e.kind === 'parent' && e.source === cur && !out.has(e.target)) { out.add(e.target); stack.push(e.target) }
    }
  }
  for (const e of edges) {
    if (e.kind !== 'spouse') continue
    const [a, b] = [e.source, e.target]
    const hasParents = (p: string) => edges.some((x) => x.kind === 'parent' && x.target === p)
    if (out.has(a) && !out.has(b) && !hasParents(b)) out.add(b)
    if (out.has(b) && !out.has(a) && !hasParents(a)) out.add(a)
  }
  return out
}
