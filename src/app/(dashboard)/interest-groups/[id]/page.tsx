import GroupView from '@/components/interest-groups/GroupView'

export default async function InterestGroupPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return <GroupView groupId={params.id} />
}
