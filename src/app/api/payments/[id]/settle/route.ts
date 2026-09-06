import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { settlePayment, computeSignature, activeGateway } from '@/lib/payments'

/**
 * Gateway callback / return handler.
 *
 * The browser reporting "payment succeeded" is not evidence. A payment only
 * becomes PAID when the signature verifies server-side, and replays are
 * idempotent because gateways retry callbacks.
 *
 * In MOCK mode the signature can be produced by /api/payments/[id]/mock-pay,
 * which stands in for the hosted checkout page.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const payment = await prisma.payment.findUnique({ where: { id: params.id } })
  if (!payment) return NextResponse.json({ message: 'Payment not found' }, { status: 404 })

  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  if (payment.paidByUserId !== session.user.id && !isStaff) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const result = await settlePayment({
    paymentId: payment.id,
    gatewayPaymentId: body.gatewayPaymentId,
    signature: body.signature,
    failed: body.failed === true,
    failureReason: body.failureReason,
  })

  if (!result.ok) return NextResponse.json({ message: result.reason }, { status: 400 })

  return NextResponse.json({
    message: result.alreadySettled
      ? 'This payment was already processed.'
      : result.status === 'PAID' ? 'Payment successful.' : 'Payment recorded as failed.',
    status: result.status,
    alreadySettled: result.alreadySettled,
  })
}

/**
 * MOCK-gateway checkout stand-in: issues the signed payload a real gateway
 * would hand back. Refuses to run when a live gateway is configured, so it
 * can never be used to fake a real payment.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (activeGateway() !== 'MOCK') {
    return NextResponse.json({ message: 'Not available with a live payment gateway' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const payment = await prisma.payment.findUnique({ where: { id: params.id } })
  if (!payment || !payment.gatewayOrderId) return NextResponse.json({ message: 'Payment not found' }, { status: 404 })
  if (payment.paidByUserId !== session.user.id) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const gatewayPaymentId = `pay_mock_${payment.id.slice(-10)}`
  return NextResponse.json({
    gatewayOrderId: payment.gatewayOrderId,
    gatewayPaymentId,
    signature: computeSignature(payment.gatewayOrderId, gatewayPaymentId),
    amountPaise: payment.amountPaise,
  })
}
