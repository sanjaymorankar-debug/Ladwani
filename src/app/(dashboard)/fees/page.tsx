import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Receipt, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatPaise } from '@/lib/payments'
import { formatDate } from '@/lib/utils'
import PayInvoiceButton from '@/components/fees/PayInvoiceButton'

export default async function FeesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const memberId = (session.user as any).memberId as string | null
  const invoices = memberId
    ? await prisma.feeInvoice.findMany({
        where: { memberId },
        include: {
          feeType: true,
          family: { select: { name: true, registrationNumber: true } },
          payments: { where: { status: 'PAID' }, select: { reference: true, paidAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const outstanding = invoices.filter((i) => i.status === 'PENDING')

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Receipt className="w-6 h-6 text-saffron-600" /> Community Fees
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Your registration and community dues</p>
      </div>

      {invoices.length === 0 ? (
        <div className="card text-center py-14">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">Nothing due</p>
          <p className="text-gray-500 text-sm mt-1">
            You have no fees to pay. Members who join an existing family register free — only the Karta
            who registers a new family is charged.
          </p>
        </div>
      ) : (
        <>
          {outstanding.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">
                  {outstanding.length} outstanding {outstanding.length === 1 ? 'payment' : 'payments'}
                </p>
                <p className="text-amber-700 mt-0.5">
                  Total due {formatPaise(outstanding.reduce((s, i) => s + i.amountPaise, 0))}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{inv.feeType.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <span className="font-mono">{inv.reference}</span>
                      {inv.family && <> · {inv.family.name} Family ({inv.family.registrationNumber})</>}
                    </p>
                    {inv.dueDate && inv.status === 'PENDING' && (
                      <p className="text-xs text-gray-500 mt-1">Due by {formatDate(inv.dueDate, 'dd MMM yyyy')}</p>
                    )}
                    {inv.status === 'PAID' && inv.payments[0] && (
                      <p className="text-xs text-green-600 mt-1">
                        Paid {inv.payments[0].paidAt ? formatDate(inv.payments[0].paidAt, 'dd MMM yyyy') : ''} ·
                        receipt <span className="font-mono">{inv.payments[0].reference}</span>
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 space-y-2">
                    <div className="text-lg font-bold text-gray-900">{formatPaise(inv.amountPaise)}</div>
                    {inv.status === 'PENDING' ? (
                      <PayInvoiceButton invoiceId={inv.id} amountPaise={inv.amountPaise} />
                    ) : (
                      <span className={`badge text-xs ${
                        inv.status === 'PAID' ? 'badge-green' : 'badge-gray'
                      }`}>
                        {inv.status === 'WAIVED' ? 'Waived' : inv.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
