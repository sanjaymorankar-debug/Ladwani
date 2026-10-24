import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Shield } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import ApprovalRulesAdmin from '@/components/admin/ApprovalRulesAdmin'
import { isActiveAdmin } from '@/lib/scope'

export default async function ApprovalRulesPage() {
  const session = await getServerSession(authOptions)
  if (!(await isActiveAdmin(session?.user?.id as string | undefined))) redirect('/dashboard')

  const rules = await prisma.approvalRule.findMany({
    orderBy: { actionCode: 'asc' },
    select: { id: true, actionCode: true, requiresApproval: true, approverRole: true, autoApproveRole: true, isActive: true },
  })

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Shield className="w-5 h-5" /> Approval Rules
        </h1>
        <p className="text-gray-500 text-sm">
          Choose which actions wait in the review queue and which take effect at once. An action with no rule
          here, or an inactive rule, always needs approval. Every change is recorded in the audit log.
        </p>
      </div>
      <ApprovalRulesAdmin initialRules={rules} />
    </div>
  )
}
