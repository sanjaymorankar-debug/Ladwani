import { Module } from '@nestjs/common'
import { MatrimonyService } from './matrimony.service'
import { MatrimonyController } from './matrimony.controller'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  providers: [MatrimonyService],
  controllers: [MatrimonyController],
})
export class MatrimonyModule {}
