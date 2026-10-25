import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { json } from '@/lib/additional-details/http'
import { backfillInterest } from '@/lib/interest-groups'

/**
 * Admin review of the hobby master (Step 3 rule 2): approve an "Other"
 * suggestion (its group is created and everyone who picked it joins), merge a
 * duplicate or misspelling into an existing hobby, reject it, or edit an
 * entry (name, category, sport, child-safe).
 *
 * body: { action: 'approve' | 'reject' | 'merge' | 'update', mergeIntoId?, name?, category?, isSport?, isChildSafe?, isActive? }
 */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getServerSession(authOptions)
  const roles = (((session?.user as any)?.roles ?? []) as string[])
  if (!roles.includes('ADMIN')) return json({ message: 'Forbidden' }, 403)
  const actorId = session!.user!.id as string

  const interest = await prisma.interest.findUnique({ where: { id: params.id } })
  if (!interest) return json({ message: 'Not found' }, 404)
  const body = await req.json().catch(() => ({}))
  const audit = (action: string, newValue: Record<string, unknown>) =>
    prisma.auditLog.create({ data: { actorId, actorRole: 'ADMIN', action, entityType: 'interest', entityId: interest.id, oldValue: { status: interest.status, name: interest.name }, newValue: newValue as any } })
  const notifySuggester = async (title: string, text: string) => {
    if (!interest.suggestedByMemberId) return
    const m = await prisma.member.findUnique({ where: { id: interest.suggestedByMemberId }, select: { userId: true } })
    if (m?.userId) await prisma.notification.create({ data: { recipientId: m.userId, senderId: actorId, type: 'SYSTEM', title, body: text } })
  }

  switch (body.action) {
    case 'approve': {
      const category = body.category ? String(body.category) : interest.category
      await prisma.interest.update({
        where: { id: interest.id },
        data: { status: 'APPROVED', category, name: body.name ? String(body.name).trim() : interest.name, reviewedBy: actorId, reviewedAt: new Date(), isChildSafe: body.isChildSafe ?? interest.isChildSafe },
      })
      await audit('interest.approve', { status: 'APPROVED' })
      await backfillInterest(interest.id, actorId)
      await notifySuggester('Your hobby was added', `"${interest.name}" is now on the hobby list and has its own group.`)
      return json({ message: 'Approved — group created and members added' })
    }
    case 'merge': {
      const target = body.mergeIntoId ? await prisma.interest.findUnique({ where: { id: String(body.mergeIntoId) } }) : null
      if (!target || target.id === interest.id || target.status !== 'APPROVED') return json({ message: 'Choose an approved hobby to merge into' }, 400)
      const affected = new Set<string>()
      await prisma.$transaction(async (tx) => {
        for (const h of await tx.memberHobby.findMany({ where: { interestId: interest.id } })) {
          affected.add(h.memberId)
          const clash = await tx.memberHobby.findUnique({ where: { memberId_interestId: { memberId: h.memberId, interestId: target.id } } })
          if (clash) await tx.memberHobby.delete({ where: { id: h.id } })
          else await tx.memberHobby.update({ where: { id: h.id }, data: { interestId: target.id } })
        }
        await tx.memberSport.updateMany({ where: { interestId: interest.id }, data: { interestId: target.id } })
        await tx.interest.update({ where: { id: interest.id }, data: { status: 'MERGED', mergedIntoId: target.id, reviewedBy: actorId, reviewedAt: new Date() } })
      })
      await audit('interest.merge', { status: 'MERGED', mergedIntoId: target.id })
      await backfillInterest(target.id, actorId)
      await notifySuggester('Your hobby was added', `"${interest.name}" was matched to "${target.name}".`)
      return json({ message: `Merged into ${target.name}`, membersMoved: affected.size })
    }
    case 'reject': {
      await prisma.interest.update({ where: { id: interest.id }, data: { status: 'REJECTED', reviewedBy: actorId, reviewedAt: new Date() } })
      await audit('interest.reject', { status: 'REJECTED' })
      await notifySuggester('Hobby not added', `"${interest.name}" was not added to the hobby list. Please pick the closest hobby from the list.`)
      return json({ message: 'Rejected' })
    }
    case 'update': {
      const data: Record<string, unknown> = {}
      if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
      if (typeof body.category === 'string') data.category = body.category
      if (typeof body.isSport === 'boolean') data.isSport = body.isSport
      if (typeof body.isChildSafe === 'boolean') data.isChildSafe = body.isChildSafe
      if (typeof body.isActive === 'boolean') data.isActive = body.isActive
      await prisma.interest.update({ where: { id: interest.id }, data })
      // The group's child-safe flag follows the master entry.
      if (typeof body.isChildSafe === 'boolean') {
        await prisma.communityGroup.updateMany({ where: { interestId: interest.id }, data: { isChildSafe: body.isChildSafe } })
      }
      if (typeof data.name === 'string') {
        await prisma.communityGroup.updateMany({ where: { interestId: interest.id, parentGroupId: null }, data: { name: data.name } })
      }
      await audit('interest.update', data)
      return json({ message: 'Saved' })
    }
    default:
      return json({ message: 'Unknown action' }, 400)
  }
}
