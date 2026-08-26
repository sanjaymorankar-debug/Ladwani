import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AssetsService } from './assets.service'
import { PrismaService } from '../prisma/prisma.service'
import { ApprovalsService } from '../common/approvals/approvals.service'

describe('AssetsService — pricing quote engine (docs/11 §4)', () => {
  let service: AssetsService
  let prisma: { asset: { findUnique: jest.Mock } }

  beforeEach(async () => {
    prisma = { asset: { findUnique: jest.fn() } }
    const moduleRef = await Test.createTestingModule({
      providers: [AssetsService, { provide: PrismaService, useValue: prisma }, { provide: ApprovalsService, useValue: { submit: jest.fn() } }],
    }).compile()
    service = moduleRef.get(AssetsService)
  })

  function baseAsset(overrides: Record<string, unknown> = {}) {
    return {
      id: 'asset-1',
      status: 'ACTIVE',
      deletedAt: null,
      taxPercent: 0,
      communityDiscountPercent: 0,
      pricing: [{ priceType: 'BASE', amount: 1000, validFrom: null, validTo: null }],
      services: [],
      ...overrides,
    }
  }

  it('uses BASE pricing on an ordinary weekday with no seasonal override', async () => {
    prisma.asset.findUnique.mockResolvedValue(baseAsset())
    const quote = await service.quote('asset-1', new Date('2027-03-16')) // Tuesday
    expect(quote.priceTypeUsed).toBe('BASE')
    expect(quote.basePrice).toBe(1000)
    expect(quote.total).toBe(1000)
  })

  it('prefers WEEKEND pricing over BASE on a Saturday/Sunday', async () => {
    prisma.asset.findUnique.mockResolvedValue(
      baseAsset({ pricing: [{ priceType: 'BASE', amount: 1000, validFrom: null, validTo: null }, { priceType: 'WEEKEND', amount: 1500, validFrom: null, validTo: null }] }),
    )
    const quote = await service.quote('asset-1', new Date('2027-03-20')) // Saturday
    expect(quote.priceTypeUsed).toBe('WEEKEND')
    expect(quote.basePrice).toBe(1500)
  })

  it('prefers SEASONAL pricing over both BASE and WEEKEND when the date falls in range', async () => {
    prisma.asset.findUnique.mockResolvedValue(
      baseAsset({
        pricing: [
          { priceType: 'BASE', amount: 1000, validFrom: null, validTo: null },
          { priceType: 'WEEKEND', amount: 1500, validFrom: null, validTo: null },
          { priceType: 'SEASONAL', amount: 3000, validFrom: new Date('2027-10-01'), validTo: new Date('2027-11-15') },
        ],
      }),
    )
    const quote = await service.quote('asset-1', new Date('2027-10-20')) // also a Wednesday, in-season
    expect(quote.priceTypeUsed).toBe('SEASONAL')
    expect(quote.basePrice).toBe(3000)
  })

  it('adds selected service line items to the subtotal', async () => {
    prisma.asset.findUnique.mockResolvedValue(
      baseAsset({ services: [{ code: 'CATERING', label: 'Catering', pricing: { amount: 200 } }, { code: 'DECOR', label: 'Decor', pricing: { amount: 100 } }] }),
    )
    const quote = await service.quote('asset-1', new Date('2027-03-16'), ['CATERING', 'DECOR'])
    expect(quote.serviceLines).toHaveLength(2)
    expect(quote.subtotal).toBe(1300)
    expect(quote.total).toBe(1300)
  })

  it('rejects an unknown or unpriced service code rather than silently ignoring it', async () => {
    prisma.asset.findUnique.mockResolvedValue(baseAsset())
    await expect(service.quote('asset-1', new Date('2027-03-16'), ['NOT_A_SERVICE'])).rejects.toBeInstanceOf(BadRequestException)
  })

  it('applies community discount before tax, both computed off the subtotal', async () => {
    prisma.asset.findUnique.mockResolvedValue(baseAsset({ communityDiscountPercent: 10, taxPercent: 18 }))
    const quote = await service.quote('asset-1', new Date('2027-03-16'))
    // subtotal 1000, discount 100 -> 900, tax 18% of 900 = 162 -> total 1062
    expect(quote.discount).toBe(100)
    expect(quote.tax).toBe(162)
    expect(quote.total).toBe(1062)
  })

  it('refuses to quote an asset with no pricing configured', async () => {
    prisma.asset.findUnique.mockResolvedValue(baseAsset({ pricing: [] }))
    await expect(service.quote('asset-1', new Date('2027-03-16'))).rejects.toBeInstanceOf(BadRequestException)
  })

  it('refuses to quote an asset that is not ACTIVE', async () => {
    prisma.asset.findUnique.mockResolvedValue(baseAsset({ status: 'PENDING_VERIFICATION' }))
    await expect(service.quote('asset-1', new Date('2027-03-16'))).rejects.toBeInstanceOf(NotFoundException)
  })
})
