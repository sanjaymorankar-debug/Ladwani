import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { AssetsService } from './assets.service'
import { RegisterAssetDto } from './dto/register-asset.dto'
import { AddPhotoDto } from './dto/add-photo.dto'
import { AddFacilityDto } from './dto/add-facility.dto'
import { AddPricingDto } from './dto/add-pricing.dto'
import { AddServiceDto } from './dto/add-service.dto'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { PermissionsGuard } from '../common/guards/permissions.guard'
import { Permissions } from '../common/decorators/permissions.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { Audited } from '../common/decorators/audited.decorator'
import type { JwtPayload } from '../auth/strategies/jwt.strategy'

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private assets: AssetsService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('asset:register')
  @Audited('asset.register.submit')
  async register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterAssetDto) {
    return { data: await this.assets.registerAsset(user.sub, dto) }
  }

  @Get('search')
  async search(@Query('categoryCode') categoryCode?: string, @Query('city') city?: string, @Query('minCapacity') minCapacity?: string) {
    return { data: await this.assets.search({ categoryCode, city, minCapacity: minCapacity ? Number(minCapacity) : undefined }) }
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return { data: await this.assets.getDetail(id) }
  }

  @Get(':id/availability')
  async getAvailability(@Param('id') id: string, @Query('from') from: string, @Query('to') to: string) {
    const dateFrom = from ? new Date(from) : new Date()
    const dateTo = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    return { data: await this.assets.getAvailability(id, dateFrom, dateTo) }
  }

  @Get(':id/quote')
  async quote(@Param('id') id: string, @Query('date') date: string, @Query('services') services?: string) {
    const serviceCodes = services ? services.split(',').filter(Boolean) : []
    return { data: await this.assets.quote(id, new Date(date), serviceCodes) }
  }

  @Post(':id/photos')
  @UseGuards(PermissionsGuard)
  @Permissions('asset:manage:own')
  async addPhoto(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: AddPhotoDto) {
    return { data: await this.assets.addPhoto(user.sub, id, dto) }
  }

  @Post(':id/facilities')
  @UseGuards(PermissionsGuard)
  @Permissions('asset:manage:own')
  async addFacility(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: AddFacilityDto) {
    return { data: await this.assets.addFacility(user.sub, id, dto) }
  }

  @Post(':id/pricing')
  @UseGuards(PermissionsGuard)
  @Permissions('asset:manage:own')
  async addPricing(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: AddPricingDto) {
    return { data: await this.assets.addPricing(user.sub, id, dto) }
  }

  @Post(':id/services')
  @UseGuards(PermissionsGuard)
  @Permissions('asset:manage:own')
  async addService(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body() dto: AddServiceDto) {
    return { data: await this.assets.addService(user.sub, id, dto) }
  }

  @Post(':id/suspend')
  @UseGuards(PermissionsGuard)
  @Permissions('asset:approve')
  @Audited('asset.suspend.submit')
  async requestSuspend(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Body('reason') reason?: string) {
    return { data: await this.assets.requestSuspend(user.sub, id, reason) }
  }
}
