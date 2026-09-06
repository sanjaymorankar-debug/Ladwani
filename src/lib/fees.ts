import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { reference } from '@/lib/payments'

/**
 * Community fees.
 *
 * Registration is charged **once per family, to the Karta who registers it**.
 * Everyone else who joins that family — spouse, children, parents — registers
 * free. The charge is therefore raised against the family, not against each
 * person, which is what makes "other members register for free" true by
 * construction rather than by remembering to skip them.
 */
export const FAMILY_REGISTRATION_FEE_CODE = 'FAMILY_REGISTRATION'

/** Amount is admin-configurable via the FeeType row. */
export async function getFamilyRegistrationFee() {
  return prisma.feeType.findUnique({ where: { code: FAMILY_REGISTRATION_FEE_CODE } })
}

/**
 * Raises the registration invoice for a newly created family, if the fee is
 * configured and active. Returns null when there's nothing to charge, so
 * family creation still works on a community that charges no fee.
 */
export async function raiseFamilyRegistrationInvoice(
  tx: Prisma.TransactionClient,
  params: { familyId: string; kartaMemberId: string }
) {
  const feeType = await tx.feeType.findUnique({ where: { code: FAMILY_REGISTRATION_FEE_CODE } })
  if (!feeType || !feeType.isActive || feeType.amountPaise <= 0) return null

  // One registration invoice per family, ever.
  const existing = await tx.feeInvoice.findFirst({
    where: { familyId: params.familyId, feeTypeId: feeType.id },
  })
  if (existing) return existing

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  return tx.feeInvoice.create({
    data: {
      reference: reference('FEE'),
      feeTypeId: feeType.id,
      familyId: params.familyId,
      memberId: params.kartaMemberId, // billed to the Karta
      amountPaise: feeType.amountPaise,
      status: 'PENDING',
      dueDate,
    },
  })
}

/**
 * Whether this member owes anything. Members who joined an existing family
 * are never billed — only the Karta who registered it is.
 */
export async function outstandingInvoicesFor(memberId: string) {
  return prisma.feeInvoice.findMany({
    where: { memberId, status: 'PENDING' },
    include: { feeType: true, family: { select: { name: true, registrationNumber: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
