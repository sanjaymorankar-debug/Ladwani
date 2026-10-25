import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { treeAccess, buildTree } from '@/lib/tree'
import { getFamilyAccess } from '@/lib/family-auth'
import FamilyTreeClient from './TreeClient'

export default async function FamilyTreePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session) return null

  // F25: non-members see nothing; linked-family members see only the connecting branch.
  const { mode, viewerMemberId } = await treeAccess(session, params.id)
  if (mode === 'NONE') notFound()
  const tree = await buildTree(params.id, mode, viewerMemberId)
  if (!tree) notFound()
  const access = await getFamilyAccess(session, params.id)

  return (
    <FamilyTreeClient
      familyId={params.id}
      familyName={tree.familyName}
      nodes={tree.nodes}
      edges={tree.edges}
      mode={mode}
      canEdit={access.isKarta || access.isStaff}
      isMember={access.isMember || access.isStaff}
    />
  )
}
