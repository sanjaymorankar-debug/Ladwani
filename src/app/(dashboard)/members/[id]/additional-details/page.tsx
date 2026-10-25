import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import DetailsWizard from '@/components/additional-details/DetailsWizard'

// Additional Details wizard. Access is decided by the API the wizard calls —
// the member, or the parent/Karta for children and members without a login.
export default async function AdditionalDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/members/${params.id}`} className="btn-ghost p-2 -ml-2" aria-label="Back to profile"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-display">Additional Details</h1>
          <p className="text-sm text-gray-500">Optional — share only what helps you get support or connect with people.</p>
        </div>
      </div>
      <DetailsWizard memberId={params.id} />
    </div>
  )
}
