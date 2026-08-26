import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { FamilyModule } from './family/family.module'
import { MembersModule } from './members/members.module'
import { ApprovalQueueModule } from './approval-queue/approval-queue.module'
import { LookupsModule } from './lookups/lookups.module'
import { MatrimonyModule } from './matrimony/matrimony.module'
import { CommunityModule } from './community/community.module'
import { NotificationsModule } from './notifications/notifications.module'
import { AssetsModule } from './assets/assets.module'
import { BookingsModule } from './bookings/bookings.module'
import { AuditInterceptor } from './common/interceptors/audit.interceptor'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    FamilyModule,
    MembersModule,
    ApprovalQueueModule,
    LookupsModule,
    MatrimonyModule,
    CommunityModule,
    NotificationsModule,
    AssetsModule,
    BookingsModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
