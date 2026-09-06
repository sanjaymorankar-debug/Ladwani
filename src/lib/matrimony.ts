import { MaritalStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'

/**
 * Who may list themselves in matrimony.
 *
 * Married members are excluded outright. The remaining statuses can all
 * legitimately be seeking a match — never-married, and those free to remarry.
 * SEPARATED is deliberately excluded: the marriage still legally stands.
 */
export const MATRIMONY_ELIGIBLE_STATUSES: MaritalStatus[] = ['UNMARRIED', 'DIVORCED', 'WIDOWED']

export function isEligibleForMatrimony(status: MaritalStatus): boolean {
  return MATRIMONY_ELIGIBLE_STATUSES.includes(status)
}

export function matrimonyIneligibleReason(status: MaritalStatus): string {
  if (status === 'MARRIED') return 'A married member cannot be listed in matrimony.'
  if (status === 'SEPARATED') return 'Separated members cannot be listed until the marriage is legally dissolved.'
  return 'This marital status is not eligible for matrimony listings.'
}

/**
 * Listing filter: opted in (isVisible) AND still eligible. Both conditions
 * matter — opting in is explicit consent, eligibility is the community rule,
 * and a profile must drop out of results the moment either stops holding.
 */
export const visibleMatrimonyWhere: Prisma.MatrimonialProfileWhereInput = {
  isVisible: true,
  member: { status: 'ACTIVE', maritalStatus: { in: MATRIMONY_ELIGIBLE_STATUSES } },
}

/**
 * Called when a member becomes married. Their listing is withdrawn
 * immediately rather than waiting for them to remember to opt out.
 */
export async function withdrawMatrimonyOnMarriage(tx: Prisma.TransactionClient, memberIds: string[]) {
  const ids = memberIds.filter(Boolean)
  if (ids.length === 0) return
  await tx.matrimonialProfile.updateMany({
    where: { memberId: { in: ids }, isVisible: true },
    data: { isVisible: false },
  })
}
