'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Loader2, CreditCard } from 'lucide-react'

export default function PayInvoiceButton({ invoiceId, amountPaise }: { invoiceId: string; amountPaise: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const pay = async () => {
    setBusy(true)
    try {
      // 1. Ask the server to open a payment for this invoice.
      const startRes = await fetch('/api/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      })
      const startJson = await startRes.json()
      if (!startRes.ok) throw new Error(startJson.message ?? 'Could not start payment')

      // 2. Checkout. In MOCK mode the server issues the signed payload a real
      //    gateway would return; with a live gateway its SDK runs here.
      const credsRes = await fetch(`/api/payments/${startJson.payment.id}/settle`)
      if (!credsRes.ok) throw new Error('Payment gateway is not available')
      const creds = await credsRes.json()

      // 3. The server verifies and decides — the browser never declares success.
      const res = await fetch(`/api/payments/${startJson.payment.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatewayPaymentId: creds.gatewayPaymentId, signature: creds.signature }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Payment failed')

      toast.success(json.message)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={pay} disabled={busy}
      className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-70">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
      {busy ? 'Processing...' : `Pay ₹${(amountPaise / 100).toLocaleString('en-IN')}`}
    </button>
  )
}
