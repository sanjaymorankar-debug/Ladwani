import { createHmac, randomUUID } from 'crypto'
import { Prisma, PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Payment handling.
 *
 * Money is integer paise throughout — ₹2,000 is 200000. No float ever touches
 * a monetary value.
 *
 * The gateway is pluggable. MOCK is the default so the entire booking and fee
 * flow can be exercised end to end without live credentials; it still signs
 * and verifies exactly like a real gateway, so swapping in Razorpay or
 * Cashfree is a matter of implementing `verifySignature` for that provider
 * rather than restructuring the flow.
 *
 * The browser is never the authority on whether money arrived: a payment only
 * becomes PAID inside `settlePayment`, after the server verifies a signature
 * it computed itself.
 */

export type PaymentPurpose = 'BOOKING' | 'FEE'

export function activeGateway(): string {
  return process.env.PAYMENT_GATEWAY || 'MOCK'
}

function signingSecret(): string {
  // Falls back to the app secret so mock mode works out of the box, but a
  // dedicated key should be set in production.
  return process.env.PAYMENT_SIGNING_SECRET || process.env.NEXTAUTH_SECRET || 'dev-payment-secret'
}

/** Deterministic signature over the fields a gateway would echo back. */
export function computeSignature(orderId: string, gatewayPaymentId: string): string {
  return createHmac('sha256', signingSecret()).update(`${orderId}|${gatewayPaymentId}`).digest('hex')
}

export function verifySignature(orderId: string, gatewayPaymentId: string, signature: string): boolean {
  const expected = computeSignature(orderId, gatewayPaymentId)
  // Constant-length compare; both are hex digests of the same length.
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

export function reference(prefix: string): string {
  return `${prefix}-${new Date().getFullYear()}-${randomUUID().split('-')[0].toUpperCase()}`
}

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Creates a payment row plus a gateway order. Returns what the client needs
 * to start checkout — never anything that would let it declare success.
 */
export async function createPayment(
  tx: Prisma.TransactionClient,
  params: {
    purpose: PaymentPurpose
    bookingId?: string
    feeInvoiceId?: string
    memberId: string
    paidByUserId: string
    amountPaise: number
  }
) {
  if (!Number.isInteger(params.amountPaise) || params.amountPaise <= 0) {
    throw new Error('amountPaise must be a positive integer (paise)')
  }

  const gatewayOrderId = `order_${randomUUID().replace(/-/g, '').slice(0, 20)}`
  return tx.payment.create({
    data: {
      reference: reference('PAY'),
      purpose: params.purpose,
      bookingId: params.bookingId ?? null,
      feeInvoiceId: params.feeInvoiceId ?? null,
      memberId: params.memberId,
      paidByUserId: params.paidByUserId,
      amountPaise: params.amountPaise,
      status: 'PENDING',
      gateway: activeGateway(),
      gatewayOrderId,
    },
  })
}

export type SettleResult =
  | { ok: true; alreadySettled: boolean; status: PaymentStatus }
  | { ok: false; reason: string }

/**
 * Verifies a gateway callback and applies its consequences: a paid booking
 * becomes CONFIRMED, a paid fee invoice becomes PAID.
 *
 * Idempotent — a replayed callback (gateways retry) returns the existing
 * outcome instead of double-applying it.
 */
export async function settlePayment(params: {
  paymentId: string
  gatewayPaymentId: string
  signature: string
  failed?: boolean
  failureReason?: string
}): Promise<SettleResult> {
  const payment = await prisma.payment.findUnique({ where: { id: params.paymentId } })
  if (!payment) return { ok: false, reason: 'Payment not found' }

  // Replay: already resolved, report the existing state rather than redoing it.
  if (payment.status === 'PAID' || payment.status === 'FAILED' || payment.status === 'CANCELLED') {
    return { ok: true, alreadySettled: true, status: payment.status }
  }

  if (params.failed) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failureReason: params.failureReason ?? 'Payment failed at gateway' },
    })
    return { ok: true, alreadySettled: false, status: 'FAILED' }
  }

  if (!payment.gatewayOrderId || !verifySignature(payment.gatewayOrderId, params.gatewayPaymentId, params.signature)) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failureReason: 'Signature verification failed' },
    })
    return { ok: false, reason: 'Signature verification failed' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', gatewayPaymentId: params.gatewayPaymentId, paidAt: new Date() },
    })

    if (payment.purpose === 'BOOKING' && payment.bookingId) {
      await tx.booking.update({ where: { id: payment.bookingId }, data: { status: 'CONFIRMED' } })
    }
    if (payment.purpose === 'FEE' && payment.feeInvoiceId) {
      await tx.feeInvoice.update({
        where: { id: payment.feeInvoiceId },
        data: { status: 'PAID', paidAt: new Date() },
      })
    }

    await tx.auditLog.create({
      data: {
        actorId: payment.paidByUserId,
        action: 'payment.settled',
        entityType: 'payment',
        entityId: payment.id,
        newValue: { amountPaise: payment.amountPaise, purpose: payment.purpose },
      },
    })
  })

  return { ok: true, alreadySettled: false, status: 'PAID' }
}

/** Quotes a booking's price from the asset's rate and the slot length. */
export function quoteBookingPaise(
  asset: { bookingMode: string; ratePerDay: number | null; ratePerHour: number | null },
  startAt: Date,
  endAt: Date
): { ok: true; amountPaise: number; units: number } | { ok: false; reason: string } {
  const ms = endAt.getTime() - startAt.getTime()
  if (ms <= 0) return { ok: false, reason: 'End time must be after start time' }

  if (asset.bookingMode === 'HOURLY') {
    if (!asset.ratePerHour) return { ok: false, reason: 'This asset has no hourly rate configured' }
    const hours = Math.ceil(ms / (60 * 60 * 1000))
    return { ok: true, amountPaise: hours * asset.ratePerHour, units: hours }
  }

  if (!asset.ratePerDay) return { ok: false, reason: 'This asset has no daily rate configured' }
  const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)))
  return { ok: true, amountPaise: days * asset.ratePerDay, units: days }
}
