import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { treeAccess, buildTree } from '@/lib/tree'

/**
 * F25 tree view. Members of the family (and Admins) get the whole tree;
 * members of a linked family only the connecting branch; others nothing.
 */
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const { mode, viewerMemberId } = await treeAccess(session, params.id)
  if (mode === 'NONE') {
    return NextResponse.json({ message: 'You do not have access to this family' }, { status: 403 })
  }
  const tree = await buildTree(params.id, mode, viewerMemberId)
  if (!tree) return NextResponse.json({ message: 'Family not found' }, { status: 404 })
  return NextResponse.json(tree)
}
