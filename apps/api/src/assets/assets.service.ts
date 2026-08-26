import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { Approval, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ApprovalsService } from '../common/approvals/approvals.service'
import { RegisterAssetDto } from './dto/register-asset.dto'
import { AddPhotoDto } from './dto/add-photo.dto'
import { AddFacilityDto } from './dto/add-facility.dto'
import { AddPricingDto } from './dto/add-pricing.dto'
import { AddServiceDto } from './dto/add-service.dto'

type Tx = Prisma.TransactionClient

export interface PriceQuote {
  basePrice: number
  priceTypeUsed: string
  serviceLines: { code: string; label: string; amount: number }[]
  subtotal: number
  discount: number
  tax: number
  total: number
}

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private approvals: ApprovalsService,
  ) {}

  async registerAsset(ownerUserId: string, dto: RegisterAssetDto) {
    const category = await this.prisma.assetCategory.findUnique({ where: { code: dto.categoryCode } })
    if (!category) throw new NotFoundException('Unknown asset category.')

    const assetOwner = await this.prisma.assetOwner.upsert({
      where: { userId: ownerUserId },
      update: {},
      create: { userId: ownerUserId },
    })

    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          assetOwnerId: assetOwner.id,
          categoryId: category.id,
          name: dto.name,
          description: dto.description,
          addressLine: dto.addressLine,
          city: dto.city,
          district: dto.district,
          state: dto.state,
          pincode: dto.pincode,
          areaId: dto.areaId,
          capacity: dto.capacity,
          bookingApprovalRequired: dto.bookingApprovalRequired ?? false,
          cancellationDeadlineDays: dto.cancellationDeadlineDays ?? 7,
          cancellationRefundPercent: dto.cancellationRefundPercent ?? 50,
          status: 'PENDING_VERIFICATION',
        },
      })

      if (dto.basePrice != null) {
        await tx.assetPricing.create({ data: { assetId: asset.id, priceType: 'BASE', amount: dto.basePrice } })
      }

      const approval = await this.approvals.submit(
        { actionCode: 'asset.register', entityType: 'Asset', entityId: asset.id, submittedBy: ownerUserId },
        tx,
      )
      if (approval.status === 'APPROVED') await this.applyAssetRegisterApproval(tx, approval)

      return asset
    })
  }

  async applyAssetRegisterApproval(tx: Tx, approval: Approval): Promise<void> {
    if (!approval.entityId) return
    await tx.asset.update({
      where: { id: approval.entityId },
      data: { status: approval.status === 'APPROVED' ? 'ACTIVE' : 'REJECTED' },
    })
  }

  async requestSuspend(adminUserId: string, assetId: string, reason?: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } })
    if (!asset || asset.deletedAt) throw new NotFoundException('Asset not found.')

    return this.approvals.submit({
      actionCode: 'asset.suspend',
      entityType: 'Asset',
      entityId: assetId,
      newValue: { reason },
      submittedBy: adminUserId,
    })
  }

  async applyAssetSuspendApproval(tx: Tx, approval: Approval): Promise<void> {
    if (!approval.entityId || approval.status !== 'APPROVED') return
    await tx.asset.update({ where: { id: approval.entityId }, data: { status: 'SUSPENDED' } })
  }

  async addPhoto(ownerUserId: string, assetId: string, dto: AddPhotoDto) {
    await this.assertOwnsAsset(ownerUserId, assetId)
    return this.prisma.assetPhoto.create({ data: { assetId, url: dto.url, sortOrder: dto.sortOrder ?? 0 } })
  }

  async addFacility(ownerUserId: string, assetId: string, dto: AddFacilityDto) {
    await this.assertOwnsAsset(ownerUserId, assetId)
    return this.prisma.assetFacility.upsert({
      where: { assetId_facilityCode: { assetId, facilityCode: dto.facilityCode } },
      update: {},
      create: { assetId, facilityCode: dto.facilityCode },
    })
  }

  async addPricing(ownerUserId: string, assetId: string, dto: AddPricingDto) {
    await this.assertOwnsAsset(ownerUserId, assetId)
    return this.prisma.assetPricing.create({
      data: { assetId, priceType: dto.priceType, amount: dto.amount, validFrom: dto.validFrom, validTo: dto.validTo },
    })
  }

  async addService(ownerUserId: string, assetId: string, dto: AddServiceDto) {
    await this.assertOwnsAsset(ownerUserId, assetId)
    return this.prisma.assetService.upsert({
      where: { assetId_code: { assetId, code: dto.code } },
      update: { label: dto.label, pricing: { upsert: { update: { amount: dto.amount }, create: { amount: dto.amount } } } },
      create: { assetId, code: dto.code, label: dto.label, pricing: { create: { amount: dto.amount } } },
    })
  }

  async search(filters: { categoryCode?: string; city?: string; minCapacity?: number }) {
    return this.prisma.asset.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        category: filters.categoryCode ? { code: filters.categoryCode } : undefined,
        city: filters.city ? { contains: filters.city } : undefined,
        capacity: filters.minCapacity ? { gte: filters.minCapacity } : undefined,
      },
      include: { category: true, photos: { orderBy: { sortOrder: 'asc' }, take: 1 }, pricing: { where: { priceType: 'BASE' } } },
      take: 30,
    })
  }

  async getDetail(assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        category: true,
        photos: { orderBy: { sortOrder: 'asc' } },
        facilities: true,
        pricing: true,
        services: { include: { pricing: true } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 10, include: { reviewer: { select: { id: true } } } },
      },
    })
    if (!asset || asset.deletedAt) throw new NotFoundException('Asset not found.')

    const ratingAgg = await this.prisma.review.aggregate({ where: { assetId }, _avg: { overallScore: true }, _count: true })

    return { ...asset, averageRating: ratingAgg._avg.overallScore, reviewCount: ratingAgg._count }
  }

  /** Missing rows are treated as AVAILABLE — rows only get materialized once something acts on that date/slot (a booking, a block). */
  async getAvailability(assetId: string, dateFrom: Date, dateTo: Date) {
    const rows = await this.prisma.assetAvailability.findMany({
      where: { assetId, date: { gte: dateFrom, lte: dateTo } },
    })
    const byDate = new Map(rows.map((r) => [`${r.date.toISOString().slice(0, 10)}:${r.slot}`, r.status]))

    const days: { date: string; slot: string; status: string }[] = []
    for (let d = new Date(dateFrom); d <= dateTo; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10)
      days.push({ date: key, slot: 'FULL_DAY', status: byDate.get(`${key}:FULL_DAY`) ?? 'AVAILABLE' })
    }
    return days
  }

  async quote(assetId: string, date: Date, serviceCodes: string[] = []): Promise<PriceQuote> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId }, include: { pricing: true, services: { include: { pricing: true } } } })
    if (!asset || asset.deletedAt || asset.status !== 'ACTIVE') throw new NotFoundException('Asset not found or not bookable.')

    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    const seasonal = asset.pricing.find((p) => p.priceType === 'SEASONAL' && this.isDateInRange(date, p.validFrom, p.validTo))
    const weekend = asset.pricing.find((p) => p.priceType === 'WEEKEND')
    const base = asset.pricing.find((p) => p.priceType === 'BASE')

    const resolved = seasonal ?? (isWeekend ? weekend : undefined) ?? base
    if (!resolved) throw new BadRequestException('This asset has no base pricing configured yet.')

    const basePrice = Number(resolved.amount)
    const serviceLines = serviceCodes.map((code) => {
      const svc = asset.services.find((s) => s.code === code)
      if (!svc || !svc.pricing) throw new BadRequestException(`Unknown or unpriced service "${code}".`)
      return { code, label: svc.label, amount: Number(svc.pricing.amount) }
    })

    const subtotal = basePrice + serviceLines.reduce((sum, l) => sum + l.amount, 0)
    const discount = (subtotal * Number(asset.communityDiscountPercent)) / 100
    const tax = ((subtotal - discount) * Number(asset.taxPercent)) / 100
    const total = Math.round((subtotal - discount + tax) * 100) / 100

    return { basePrice, priceTypeUsed: resolved.priceType, serviceLines, subtotal, discount, tax, total }
  }

  async assertOwnsAsset(userId: string, assetId: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId }, include: { assetOwner: true } })
    if (!asset) throw new NotFoundException('Asset not found.')
    if (asset.assetOwner.userId !== userId) throw new ForbiddenException('You do not own this asset.')
  }

  private isDateInRange(date: Date, from: Date | null, to: Date | null): boolean {
    if (from && date < from) return false
    if (to && date > to) return false
    return true
  }
}
