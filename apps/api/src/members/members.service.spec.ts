import { Test } from '@nestjs/testing'
import { ConflictException, ForbiddenException } from '@nestjs/common'
import { MembersService } from './members.service'
import { PrismaService } from '../prisma/prisma.service'
import { ApprovalsService } from '../common/approvals/approvals.service'
import { DuplicateDetectionService } from '../common/duplicate-detection/duplicate-detection.service'
import { RelationshipsService } from '../common/relationships/relationships.service'
import { FamilyAuthorizationService } from '../common/family-authorization/family-authorization.service'

describe('MembersService', () => {
  let service: MembersService
  let prisma: {
    member: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock; create: jest.Mock }
    familyMember: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock }
    userRole: { findMany: jest.Mock }
    maritalStatusHistory: { create: jest.Mock }
    marriageRecord: { create: jest.Mock }
  }
  let approvals: { submit: jest.Mock }
  let familyAuth: { isKartaOf: jest.Mock; assertIsKarta: jest.Mock }

  beforeEach(async () => {
    prisma = {
      member: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), create: jest.fn() },
      familyMember: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      userRole: { findMany: jest.fn() },
      maritalStatusHistory: { create: jest.fn() },
      marriageRecord: { create: jest.fn() },
    }
    approvals = { submit: jest.fn() }
    familyAuth = { isKartaOf: jest.fn(), assertIsKarta: jest.fn() }

    const moduleRef = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ApprovalsService, useValue: approvals },
        { provide: DuplicateDetectionService, useValue: { checkMember: jest.fn().mockResolvedValue([]) } },
        { provide: RelationshipsService, useValue: { linkMembers: jest.fn() } },
        { provide: FamilyAuthorizationService, useValue: familyAuth },
      ],
    }).compile()

    service = moduleRef.get(MembersService)
  })

  describe('Karta-vs-member permission boundaries', () => {
    it('lets the member themself submit their own marital status change', async () => {
      prisma.member.findUnique.mockResolvedValue({ id: 'm1', userId: 'u1', deletedAt: null })
      approvals.submit.mockResolvedValue({ id: 'a1', status: 'SUBMITTED' })

      await service.changeMaritalStatus('m1', 'u1', { status: 'MARRIED', spouseMode: 'NON_COMMUNITY', externalSpouseName: 'Anita' } as never)

      expect(approvals.submit).toHaveBeenCalled()
      expect(familyAuth.isKartaOf).not.toHaveBeenCalled()
    })

    it("lets the member's family Karta submit a marital status change on their behalf", async () => {
      prisma.member.findUnique.mockResolvedValue({ id: 'm1', userId: 'other-user', deletedAt: null })
      prisma.familyMember.findMany.mockResolvedValue([{ familyId: 'fam-1' }])
      familyAuth.isKartaOf.mockResolvedValue(true)
      approvals.submit.mockResolvedValue({ id: 'a1', status: 'SUBMITTED' })

      await service.changeMaritalStatus('m1', 'karta-user', { status: 'UNMARRIED' } as never)

      expect(familyAuth.isKartaOf).toHaveBeenCalledWith('karta-user', 'fam-1')
      expect(approvals.submit).toHaveBeenCalled()
    })

    it('rejects a plain member (not self, not Karta, not Admin) trying to change someone else\'s marital status', async () => {
      prisma.member.findUnique.mockResolvedValue({ id: 'm1', userId: 'other-user', deletedAt: null })
      prisma.familyMember.findMany.mockResolvedValue([{ familyId: 'fam-1' }])
      familyAuth.isKartaOf.mockResolvedValue(false)
      prisma.userRole.findMany.mockResolvedValue([{ role: { code: 'MEMBER' } }])

      await expect(service.changeMaritalStatus('m1', 'stranger-user', { status: 'UNMARRIED' } as never)).rejects.toBeInstanceOf(
        ForbiddenException,
      )
      expect(approvals.submit).not.toHaveBeenCalled()
    })

    it('lets an Admin mark a member deceased even without Karta authority over that family', async () => {
      prisma.member.findUnique.mockResolvedValue({ id: 'm1', userId: 'other-user', status: 'ACTIVE', deletedAt: null })
      prisma.familyMember.findMany.mockResolvedValue([{ familyId: 'fam-1' }])
      familyAuth.isKartaOf.mockResolvedValue(false)
      prisma.userRole.findMany.mockResolvedValue([{ role: { code: 'ADMIN' } }])
      approvals.submit.mockResolvedValue({ id: 'a1', status: 'SUBMITTED' })

      await service.markDeceased('m1', 'admin-user', { deceasedAt: new Date('2026-01-01') } as never)

      expect(approvals.submit).toHaveBeenCalled()
    })

    it('rejects a non-Karta, non-Admin trying to mark a member deceased', async () => {
      prisma.member.findUnique.mockResolvedValue({ id: 'm1', userId: 'other-user', status: 'ACTIVE', deletedAt: null })
      prisma.familyMember.findMany.mockResolvedValue([{ familyId: 'fam-1' }])
      familyAuth.isKartaOf.mockResolvedValue(false)
      prisma.userRole.findMany.mockResolvedValue([{ role: { code: 'MEMBER' } }])

      await expect(service.markDeceased('m1', 'stranger-user', { deceasedAt: new Date() } as never)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('only the Karta can remove a member from the family (self-service, no queue)', async () => {
      familyAuth.assertIsKarta.mockRejectedValue(new ForbiddenException())

      await expect(service.removeMember('fam-1', 'm2', 'not-karta-user')).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.familyMember.update).not.toHaveBeenCalled()
    })
  })

  describe('deceased members are never hard-deleted', () => {
    it('marks a member deceased via a status field update, never a delete call', async () => {
      const tx = { member: { update: jest.fn().mockResolvedValue({}), delete: jest.fn() } }
      const approval = {
        status: 'APPROVED',
        entityId: 'm1',
        newValue: { deceasedAt: '2026-01-01T00:00:00.000Z', deceasedPlace: 'Pune' },
      } as never

      await service.applyMarkDeceasedApproval(tx as never, approval)

      expect(tx.member.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'DECEASED', deceasedAt: new Date('2026-01-01T00:00:00.000Z'), deceasedPlace: 'Pune' },
      })
      expect(tx.member.delete).not.toHaveBeenCalled()
    })

    it('does not apply anything if the approval was rejected', async () => {
      const tx = { member: { update: jest.fn(), delete: jest.fn() } }
      const approval = { status: 'REJECTED', entityId: 'm1', newValue: { deceasedAt: '2026-01-01' } } as never

      await service.applyMarkDeceasedApproval(tx as never, approval)

      expect(tx.member.update).not.toHaveBeenCalled()
      expect(tx.member.delete).not.toHaveBeenCalled()
    })

    it('removing a member from a family only soft-closes the membership, never deletes the member', async () => {
      familyAuth.assertIsKarta.mockResolvedValue(undefined)
      prisma.familyMember.findUnique.mockResolvedValue({ id: 'fm1', isKarta: false, leftAt: null })
      prisma.familyMember.update.mockResolvedValue({ id: 'fm1', leftAt: new Date() })

      await service.removeMember('fam-1', 'm2', 'karta-user', 'MARRIED_OUT')

      expect(prisma.familyMember.update).toHaveBeenCalledWith({
        where: { id: 'fm1' },
        data: { leftAt: expect.any(Date), leftReason: 'MARRIED_OUT' },
      })
      expect(prisma.member.delete).not.toHaveBeenCalled()
    })

    it('refuses to let the Karta remove themself without transferring Karta first', async () => {
      familyAuth.assertIsKarta.mockResolvedValue(undefined)
      prisma.familyMember.findUnique.mockResolvedValue({ id: 'fm1', isKarta: true, leftAt: null })

      await expect(service.removeMember('fam-1', 'karta-member-id', 'karta-user')).rejects.toBeInstanceOf(ConflictException)
    })
  })
})
