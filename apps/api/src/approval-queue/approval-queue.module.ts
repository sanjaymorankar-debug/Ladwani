import { Module } from '@nestjs/common'
import { ApprovalQueueService } from './approval-queue.service'
import { ApprovalQueueController } from './approval-queue.controller'
import { ApprovalsModule } from '../common/approvals/approvals.module'
import { FamilyModule } from '../family/family.module'
import { MembersModule } from '../members/members.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [ApprovalsModule, FamilyModule, MembersModule, NotificationsModule],
  providers: [ApprovalQueueService],
  controllers: [ApprovalQueueController],
})
export class ApprovalQueueModule {}
