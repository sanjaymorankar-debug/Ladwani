import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { deletePhotoObjects } from '@/lib/storage'
import { p4Fixtures } from '../p4/fixtures'

export { actAs, json } from '../p1/fixtures'
export type { Person } from '../p2/fixtures'

export const png = () => sharp({ create: { width: 24, height: 24, channels: 3, background: '#c33' } }).png().toBuffer()

export function photoForm(buf: Buffer, fields: Record<string, string> = {}, type = 'image/png') {
  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array(buf)], { type }), 'p.png')
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return new Request('http://x', { method: 'POST', body: fd })
}

/** P4 fixtures plus cleanup of posts, photos, reports, friendships and bureau rows. */
export function p5Fixtures(prefix: string) {
  const base = p4Fixtures(prefix)
  async function cleanup() {
    const users = base.userIds
    const members = base.memberIds
    const posts = (await prisma.post.findMany({ where: { authorId: { in: users } }, select: { id: true } })).map((p) => p.id)
    const photos = await prisma.photo.findMany({ where: { OR: [{ uploadedBy: { in: users } }, { postId: { in: posts } }] } })
    const comments = (await prisma.comment.findMany({ where: { OR: [{ postId: { in: posts } }, { authorId: { in: users } }] }, select: { id: true } })).map((c) => c.id)
    await prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: users } }, { reportableId: { in: [...posts, ...comments, ...photos.map((p) => p.id)] } }] } })
    await prisma.reaction.deleteMany({ where: { OR: [{ postId: { in: posts } }, { userId: { in: users } }] } })
    await prisma.comment.deleteMany({ where: { parentId: { not: null }, id: { in: comments } } })
    await prisma.comment.deleteMany({ where: { id: { in: comments } } })
    await prisma.member.updateMany({ where: { profilePhotoId: { in: photos.map((p) => p.id) } }, data: { profilePhotoId: null } })
    for (const p of photos) await deletePhotoObjects([p.storageKey, p.optimizedKey, p.thumbnailKey])
    await prisma.photo.deleteMany({ where: { id: { in: photos.map((p) => p.id) } } })
    await prisma.post.deleteMany({ where: { id: { in: posts } } })
    const lists = (await prisma.friendList.findMany({ where: { ownerMemberId: { in: members } }, select: { id: true } })).map((l) => l.id)
    await prisma.friendListMember.deleteMany({ where: { OR: [{ listId: { in: lists } }, { friendMemberId: { in: members } }] } })
    await prisma.friendList.deleteMany({ where: { id: { in: lists } } })
    await prisma.friendship.deleteMany({ where: { OR: [{ requesterMemberId: { in: members } }, { addresseeMemberId: { in: members } }] } })
    await prisma.matrimonialInterest.deleteMany({ where: { OR: [{ fromMemberId: { in: members } }, { toMemberId: { in: members } }] } })
    await prisma.matrimonialProfile.deleteMany({ where: { memberId: { in: members } } })
    await prisma.memberProfileDetail.deleteMany({ where: { memberId: { in: members } } })
    await base.cleanup()
  }
  return { ...base, cleanup }
}
