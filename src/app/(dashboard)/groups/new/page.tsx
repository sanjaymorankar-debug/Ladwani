import { prisma } from '@/lib/prisma'
import NewGroupForm from '@/components/groups/NewGroupForm'

export default async function NewGroupPage() {
  const areas = await prisma.area.findMany({
    where: { isActive: true, type: { not: 'GROUP' } },
    select: { id: true, name: true, type: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  return <NewGroupForm areas={areas} />
}
