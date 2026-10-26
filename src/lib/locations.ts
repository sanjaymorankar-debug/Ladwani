import { prisma } from '@/lib/prisma'

/** P0/P1 location master helpers (State > District > Taluka > Village/City). */
export interface AreaNode { id: string; name: string; type: string; parentId: string | null; isActive: boolean }

/** The area and every ancestor, nearest first. */
export async function areaChain(areaId: string): Promise<AreaNode[]> {
  const chain: AreaNode[] = []
  let id: string | null = areaId
  for (let i = 0; id && i < 10; i++) {
    const a: AreaNode | null = await prisma.area.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, parentId: true, isActive: true },
    })
    if (!a) break
    chain.push(a)
    id = a.parentId
  }
  return chain
}

export function chainLevel(chain: AreaNode[], type: string) {
  return chain.find((a) => a.type === type) ?? null
}

/** The district an area sits in (itself if it is one), or null. */
export async function districtOf(areaId: string | null | undefined): Promise<string | null> {
  if (!areaId) return null
  return chainLevel(await areaChain(areaId), 'DISTRICT')?.id ?? null
}

/**
 * A Mul Gaon / address location must be an active Village or City that sits
 * under a District and a State. Returns the chain, or an error message.
 */
export async function validateSettlement(areaId: unknown): Promise<{ chain: AreaNode[] } | { error: string }> {
  if (typeof areaId !== 'string' || !areaId) return { error: 'Select the village or city' }
  const chain = await areaChain(areaId)
  const leaf = chain[0]
  if (!leaf || !['VILLAGE', 'CITY'].includes(leaf.type)) return { error: 'Select a village or city from the list' }
  if (!leaf.isActive) return { error: 'That village or city is no longer listed' }
  if (!chainLevel(chain, 'DISTRICT') || !chainLevel(chain, 'STATE')) {
    return { error: 'That place is not under a district and state in the location master' }
  }
  return { chain }
}

/** Flat text copies kept on members/addresses for display and search. */
export function chainText(chain: AreaNode[]) {
  return {
    village: chain[0]?.name ?? null,
    taluka: chainLevel(chain, 'TALUKA')?.name ?? null,
    district: chainLevel(chain, 'DISTRICT')?.name ?? null,
    state: chainLevel(chain, 'STATE')?.name ?? null,
  }
}
