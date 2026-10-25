import GroupView from '@/components/interest-groups/GroupView'

export default function InterestGroupPage({ params }: { params: { id: string } }) {
  return <GroupView groupId={params.id} />
}
