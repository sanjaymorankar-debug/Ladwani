import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="h-1 bg-gradient-to-r from-saffron-400 via-orange-500 to-amber-400" />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-saffron-600 hover:text-saffron-700 mb-8 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-gray-500 mt-2 text-sm">Last updated: August 2026 · Version 1.0</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. Who We Are</h2>
            <p>Mi Ladwani is the official digital platform for Ladwani Samaj, operated by the Ladwani Samaj community organisation. This platform helps community members maintain family records, connect with other members, and participate in community activities.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. What Data We Collect</h2>
            <p>We collect the following categories of personal data:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Account information:</strong> Name, mobile number, email address, and password (hashed)</li>
              <li><strong>Family information:</strong> Family name, native village, Gotra, Kuladevata (all optional)</li>
              <li><strong>Personal profile:</strong> Date of birth, gender, current city, education, employment, skills</li>
              <li><strong>Photographs:</strong> Profile photo, family photographs (with your consent)</li>
              <li><strong>Usage data:</strong> Login times, IP addresses (for security purposes)</li>
            </ul>
            <p className="mt-3"><strong>We do not collect:</strong> Aadhaar numbers, PAN numbers, government IDs, exact bank or financial information, or any data not necessary for platform operation.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Maintaining the community member directory</li>
              <li>Operating the family registry and family tree features</li>
              <li>Enabling matrimonial discovery (only if you opt in)</li>
              <li>Sending community announcements and notifications (with your consent)</li>
              <li>Securing the platform and preventing fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. Privacy Controls</h2>
            <p>You have detailed control over the visibility of your information. Each field can be set to one of seven privacy levels:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Public (Community):</strong> Visible to anyone who visits the platform</li>
              <li><strong>Registered Members:</strong> Visible to all verified members</li>
              <li><strong>Same Area:</strong> Visible to members in your geographic area</li>
              <li><strong>Same Family:</strong> Visible only to your family members</li>
              <li><strong>Matrimony Only:</strong> Visible only in the matrimonial context</li>
              <li><strong>Admin/Operator Only:</strong> Visible only to platform administrators</li>
              <li><strong>Private:</strong> Visible only to you</li>
            </ul>
            <p className="mt-3">Contact information (mobile, email) is <strong>Private by default</strong>. We never expose contact details directly in matrimonial search.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. Your Rights (DPDP Act 2023)</h2>
            <p>Under the Digital Personal Data Protection Act 2023, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Access:</strong> Request a copy of all personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion of your data (subject to legal retention requirements for community records)</li>
              <li><strong>Grievance:</strong> Lodge a complaint with our Data Protection Officer</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact the platform administrator through your account settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. Data Security</h2>
            <p>We protect your data using:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>HTTPS encryption for all data in transit</li>
              <li>bcrypt hashing for passwords (never stored in plaintext)</li>
              <li>Encrypted storage for sensitive fields (mobile, email)</li>
              <li>Role-based access controls on all data</li>
              <li>Complete audit trail for all sensitive operations</li>
              <li>Secure, access-controlled file storage (no public URLs)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. Contact</h2>
            <p>For privacy concerns, data access requests, or complaints, contact the Ladwani Samaj platform administrator through your account, or email the Data Protection Officer at the community office.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
