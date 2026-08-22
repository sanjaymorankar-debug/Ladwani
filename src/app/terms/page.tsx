import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="h-1 bg-gradient-to-r from-saffron-400 via-orange-500 to-amber-400" />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-saffron-600 hover:text-saffron-700 mb-8 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-gray-500 mt-2 text-sm">Last updated: August 2026 · Version 1.0</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-gray-700">
          {[
            {
              title: '1. Acceptance',
              content: 'By registering on Mi Ladwani, you agree to these Terms of Service. This platform is exclusively for members of Ladwani Samaj and their immediate family. Registration requires approval by platform operators.'
            },
            {
              title: '2. Eligibility',
              content: 'You must be a member of Ladwani Samaj, or the spouse or immediate family of a community member, to register. False registration is grounds for immediate account termination.'
            },
            {
              title: '3. Accurate Information',
              content: 'You agree to provide accurate, true, and current information about yourself and your family. Deliberately false family information or impersonation of another person is prohibited and may result in account suspension and reporting to community leadership.'
            },
            {
              title: '4. Family Data Responsibility',
              content: 'Family Heads (Karta) are responsible for the accuracy of their family records. Changes to another family member\'s information must be made with that member\'s knowledge and consent. Sensitive personal information such as marital status changes and deceased status must be submitted through the approval workflow.'
            },
            {
              title: '5. Matrimonial Module',
              content: 'The matrimonial module is a facilitation service only. Mi Ladwani does not verify the accuracy of matrimonial profiles beyond basic platform verification. Contact between parties is facilitated through the platform — direct personal contact details are not shared without both parties\' consent. Mi Ladwani is not responsible for the outcome of matrimonial introductions.'
            },
            {
              title: '6. Community Conduct',
              content: 'All members must maintain respectful conduct. Harassment, defamatory posts, false information, and content that brings the community into disrepute are strictly prohibited. Reported content will be reviewed by platform operators and may result in suspension.'
            },
            {
              title: '7. Privacy of Others',
              content: 'You must not share, screenshot, or distribute personal information of other members outside the platform without their explicit consent. Community directory information is for community connection purposes only — commercial use is prohibited.'
            },
            {
              title: '8. Intellectual Property',
              content: 'Family photographs and personal information uploaded to the platform remain the property of the respective family/member. By uploading, you grant Mi Ladwani a limited licence to display and store the content for platform operation purposes only.'
            },
            {
              title: '9. Account Suspension',
              content: 'Accounts may be suspended or terminated for: providing false information, violating community conduct standards, misusing another member\'s data, or at the request of community leadership. Suspended members may appeal to the platform administrator.'
            },
            {
              title: '10. Changes to Terms',
              content: 'These Terms may be updated. Members will be notified of significant changes. Continued use of the platform after notification constitutes acceptance of the new Terms.'
            },
          ].map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-gray-900 mb-3">{section.title}</h2>
              <p>{section.content}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
