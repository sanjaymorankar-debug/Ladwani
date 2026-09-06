import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createPayment } from '@/lib/payments'

/** The signed-in member's own fee invoices. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  if (!memberId) return NextResponse.json({ invoices: [] })

  const invoices = await prisma.feeInvoice.findMany({
    where: { memberId },
    include: {
      feeType: { select: { code: true, label: true } },
      family: { select: { name: true, registrationNumber: true } },
      payments: { select: { id: true, status: true, paidAt: true, reference: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ invoices })
}

/** Starts payment for one invoice. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const memberId = (session.user as any).memberId as string | null
  const body = await req.json()
  if (!body.invoiceId) return NextResponse.json({ message: 'invoiceId is required' }, { status: 400 })

  const invoice = await prisma.feeInvoice.findUnique({ where: { id: body.invoiceId } })
  if (!invoice) return NextResponse.json({ message: 'Invoice not found' }, { status: 404 })

  // Only the person billed (or staff) may pay it.
  const roles = ((session.user as any).roles ?? []) as string[]
  const isStaff = roles.includes('ADMIN') || roles.includes('OPERATOR')
  if (invoice.memberId !== memberId && !isStaff) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  if (invoice.status === 'PAID') return NextResponse.json({ message: 'This invoice is already paid.' }, { status: 409 })
  if (invoice.status === 'WAIVED') return NextResponse.json({ message: 'This fee has been waived.' }, { status: 409 })
  if (invoice.status === 'CANCELLED') return NextResponse.json({ message: 'This invoice was cancelled.' }, { status: 409 })

  // Reuse an in-flight payment rather than stacking up orders on retries.
  const pending = await prisma.payment.findFirst({
    where: { feeInvoiceId: invoice.id, status: { in: ['CREATED', 'PENDING'] } },
  })
  const payment = pending ?? await prisma.$transaction((tx) =>
    createPayment(tx, {
      purpose: 'FEE',
      feeInvoiceId: invoice.id,
      memberId: invoice.memberId,
      paidByUserId: session.user!.id as string,
      amountPaise: invoice.amountPaise,
    })
  )

  return NextResponse.json({
    payment: {
      id: payment.id, reference: payment.reference, amountPaise: payment.amountPaise,
      gateway: payment.gateway, gatewayOrderId: payment.gatewayOrderId,
    },
  })
}
