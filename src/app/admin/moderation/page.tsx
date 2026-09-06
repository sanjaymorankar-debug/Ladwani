import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ShieldCheck } from 'lucide-react'
import PostModerationQueue from '@/components/admin/PostModerationQueue'

export default async function ModerationPage() {
  const session = await getServerSession(authOptions)
  const roles = ((session?.user as any)?.roles ?? []) as string[]
  if (!roles.includes('ADMIN') && !roles.includes('OPERATOR')) redirect('/dashboard')

  const posts = await prisma.post.findMany({
    where: { status: 'PENDING_APPROVAL', deletedAt: null },
    include: {
      postType: { select: { label: true, icon: true } },
      author: { select: { member: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> Post Moderation
        </h1>
        <p className="text-gray-500 text-sm">
          Community posts stay hidden until approved here. {posts.length} waiting.
        </p>
      </div>

      <PostModerationQueue posts={posts as any} />
    </div>
  )
}
