import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { MatrimonyService } from './matrimony.service'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

describe('MatrimonyService', () => {
  let service: MatrimonyService
  let prisma: {
    matrimonyProfile: { findUnique: jest.Mock }
    member: { findUnique: jest.Mock }
    matrimonyInterest: { findFirst: jest.Mock }
    user: { findUnique: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      matrimonyProfile: { findUnique: jest.fn() },
      member: { findUnique: jest.fn() },
      matrimonyInterest: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        MatrimonyService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
      ],
    }).compile()

    service = moduleRef.get(MatrimonyService)
  })

  describe('getDetail — matrimony field visibility never leaks beyond configured level', () => {
    it('refuses to show a profile the owner has not made visible', async () => {
      prisma.matrimonyProfile.findUnique.mockResolvedValue({
        memberId: 'target-1',
        isVisible: false,
        member: { userId: 'owner-user', firstName: 'Anita', dateOfBirth: null },
      })

      await expect(service.getDetail('viewer-user', 'target-1')).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('404s when no matrimonial profile exists at all', async () => {
      prisma.matrimonyProfile.findUnique.mockResolvedValue(null)
      await expect(service.getDetail('viewer-user', 'missing')).rejects.toBeInstanceOf(NotFoundException)
    })

    it('never reveals contact details without an accepted CONTACT_REQUEST between this exact pair', async () => {
      prisma.matrimonyProfile.findUnique.mockResolvedValue({
        memberId: 'target-1',
        isVisible: true,
        about: 'Loves trekking',
        heightCm: 170,
        languages: ['Marathi'],
        allowContactRequests: true,
        preference: null,
        member: { userId: 'owner-user', firstName: 'Anita', lastName: 'D', gender: 'FEMALE', dateOfBirth: null, currentCity: 'Pune' },
      })
      prisma.member.findUnique.mockResolvedValue({ id: 'viewer-member-1', userId: 'viewer-user' })
      prisma.matrimonyInterest.findFirst.mockResolvedValue(null)

      const result = await service.getDetail('viewer-user', 'target-1')

      expect(result.contactRevealed).toBe(false)
      expect(result.contact).toBeUndefined()
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('reveals contact details only once this exact viewer has an accepted CONTACT_REQUEST', async () => {
      prisma.matrimonyProfile.findUnique.mockResolvedValue({
        memberId: 'target-1',
        isVisible: true,
        about: 'Loves trekking',
        heightCm: 170,
        languages: ['Marathi'],
        allowContactRequests: true,
        preference: null,
        member: { userId: 'owner-user', firstName: 'Anita', lastName: 'D', gender: 'FEMALE', dateOfBirth: null, currentCity: 'Pune' },
      })
      prisma.member.findUnique.mockResolvedValue({ id: 'viewer-member-1', userId: 'viewer-user' })
      prisma.matrimonyInterest.findFirst.mockResolvedValue({ id: 'interest-1', status: 'ACCEPTED', kind: 'CONTACT_REQUEST' })
      prisma.user.findUnique.mockResolvedValue({ mobile: '9999999999', email: 'anita@example.com' })

      const result = await service.getDetail('viewer-user', 'target-1')

      expect(result.contactRevealed).toBe(true)
      expect(result.contact).toEqual({ mobile: '9999999999', email: 'anita@example.com' })
      expect(prisma.matrimonyInterest.findFirst).toHaveBeenCalledWith({
        where: { fromMemberId: 'viewer-member-1', toMemberId: 'target-1', kind: 'CONTACT_REQUEST', status: 'ACCEPTED' },
      })
    })

    it("always lets the profile's own owner see their own profile even while not publicly visible", async () => {
      prisma.matrimonyProfile.findUnique.mockResolvedValue({
        memberId: 'target-1',
        isVisible: false,
        about: 'Draft',
        preference: null,
        member: { userId: 'owner-user', firstName: 'Anita', lastName: 'D', gender: 'FEMALE', dateOfBirth: null, currentCity: 'Pune' },
      })
      prisma.member.findUnique.mockResolvedValue({ id: 'target-1', userId: 'owner-user' })

      const result = await service.getDetail('owner-user', 'target-1')

      expect(result.about).toBe('Draft')
    })
  })
})
