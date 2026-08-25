import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { MembersService } from './members.service'
import { ChangeMaritalStatusDto } from './dto/change-marital-status.dto'
import { MarkDeceasedDto } from './dto/mark-deceased.dto'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { Permissions } from '../common/decorators/permissions.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Audited } from '../common/decorators/audited.decorator'
import { ViewerContextService } from '../common/privacy/viewer-context.service'
import type { JwtPayload } from '../auth/strategies/jwt.strategy'

@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(
    private members: MembersService,
    private viewerContext: ViewerContextService,
  ) {}

  @Get('search')
  async search(@Query('q') q: string, @CurrentUser() user: JwtPayload) {
    const viewer = await this.viewerContext.build(user.sub)
    return { data: await this.members.search(q, viewer) }
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const viewer = await this.viewerContext.build(user.sub)
    return { data: await this.members.getById(id, viewer) }
  }

  @Patch(':id/marital-status')
  @UseGuards(PermissionsGuard)
  @Permissions('member:marital_status:edit')
  @Audited('member.marital_status.change.submit')
  async changeMaritalStatus(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: ChangeMaritalStatusDto) {
    return { data: await this.members.changeMaritalStatus(id, user.sub, dto) }
  }

  @Patch(':id/deceased')
  @UseGuards(PermissionsGuard)
  @Permissions('member:mark_deceased')
  @Audited('member.mark_deceased.submit')
  async markDeceased(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: MarkDeceasedDto) {
    return { data: await this.members.markDeceased(id, user.sub, dto) }
  }
}
