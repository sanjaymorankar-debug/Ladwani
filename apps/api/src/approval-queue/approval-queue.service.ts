import { Injectable } from '@nestjs/common'
import type { Approval, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ApprovalsService, ApprovalDecision } from '../common/approvals/approvals.service'
import { FamilyService } from '../family/family.service'
import { MembersService } from '../members/members.service'

type Tx = Prisma.TransactionClient

/**
 * Maps a resolved approval's actionCode to the module that knows how to
 * apply it — the wiring docs/12-approval-workflow.md and M0 deliberately
 * deferred to M1+ (see ApprovalsService's own docstring).
 */
@Injectable()
export class ApprovalQueueService {
  constructor(
    private prisma: PrismaService,
    private approvals: ApprovalsService,
    private familyService: FamilyService,
    private membersService: MembersService,
  ) {}

  list(status?: string) {
    return this.prisma.approval.findMany({
      where: status ? { status } : { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      orderBy: { submittedAt: 'asc' },
    })
  }

  async decide(approvalId: string, reviewerId: string, decision: ApprovalDecision, note?: string): Promise<Approval> {
    return this.prisma.$transaction(async (tx) => {
      const approval = await this.approvals.decide(approvalId, decision, reviewerId, note, tx)
      await this.apply(tx, approval)
      return approval
    })
  }

  private async apply(tx: Tx, approval: Approval): Promise<void> {
    switch (approval.actionCode) {
      case 'family.create':
        return this.familyService.applyFamilyCreateApproval(tx, approval)
      case 'family.member.add':
        return this.membersService.applyFamilyMemberAddApproval(tx, approval)
      case 'member.marital_status.change':
        return this.membersService.applyMaritalStatusApproval(tx, approval)
      case 'member.mark_deceased':
        return this.membersService.applyMarkDeceasedApproval(tx, approval)
      default:
        return
    }
  }
}
