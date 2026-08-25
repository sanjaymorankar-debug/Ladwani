import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface SubmitApprovalInput {
  actionCode: string
  entityType?: string
  entityId?: string
  oldValue?: unknown
  newValue?: unknown
  submittedBy: string
}

export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'RETURNED'

/**
 * Generic approval engine — docs/12-approval-workflow.md. This module only
 * owns the DRAFT→SUBMITTED→UNDER_REVIEW→(APPROVED|REJECTED|RETURNED) state
 * machine and the approval_rules lookup. Applying an APPROVED change to the
 * actual entity is the owning module's job (e.g. FamiliesService), wired in
 * as action types are added starting M1 — deliberately not implemented here.
 */
@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async submit(input: SubmitApprovalInput) {
    const rule = await this.prisma.approvalRule.findUnique({ where: { actionCode: input.actionCode } })
    const requiresApproval = rule?.requiresApproval ?? true

    return this.prisma.approval.create({
      data: {
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValue: input.oldValue as never,
        newValue: input.newValue as never,
        submittedBy: input.submittedBy,
        status: requiresApproval ? 'SUBMITTED' : 'APPROVED',
      },
    })
  }

  async startReview(id: string) {
    const approval = await this.mustFind(id)
    if (approval.status !== 'SUBMITTED') {
      throw new ConflictException('Only a submitted approval can move to review')
    }
    return this.prisma.approval.update({ where: { id }, data: { status: 'UNDER_REVIEW' } })
  }

  async decide(id: string, decision: ApprovalDecision, reviewedBy: string, reviewNote?: string) {
    const approval = await this.mustFind(id)
    if (approval.status !== 'SUBMITTED' && approval.status !== 'UNDER_REVIEW') {
      throw new ConflictException('This approval has already been resolved')
    }
    return this.prisma.approval.update({
      where: { id },
      data: { status: decision, reviewedBy, reviewedAt: new Date(), reviewNote },
    })
  }

  private async mustFind(id: string) {
    const approval = await this.prisma.approval.findUnique({ where: { id } })
    if (!approval) throw new NotFoundException('Approval not found')
    return approval
  }
}
