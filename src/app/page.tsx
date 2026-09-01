import Link from 'next/link'
import Image from 'next/image'
import {
  Users, Heart, Search, Shield, TreePine, MapPin,
  Bell, ChevronRight, Star, Building2, Globe2
} from 'lucide-react'

const features = [
  {
    icon: Users,
    title: 'Family Registry',
    desc: 'Maintain your complete family tree across generations. Track relationships, births, marriages, and history.',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    icon: TreePine,
    title: 'Interactive Family Tree',
    desc: 'Visualise your family tree beautifully. Explore branches, view profiles, and print your heritage.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: Search,
    title: 'Member Directory',
    desc: 'Find and connect with Ladwani community members across India and the world.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Heart,
    title: 'Matrimony',
    desc: 'Trusted matrimonial discovery within our community. Privacy-first with family-controlled visibility.',
    color: 'bg-pink-50 text-pink-600',
  },
  {
    icon: Bell,
    title: 'Community Updates',
    desc: 'Stay connected with announcements, events, achievements, and news from your area.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Shield,
    title: 'Verified & Trusted',
    desc: 'Every family is verified by our team. Your data is protected with role-based access controls.',
    color: 'bg-teal-50 text-teal-600',
  },
]

const stats = [
  { number: '500+', label: 'Registered Families' },
  { number: '2,000+', label: 'Community Members' },
  { number: '15+', label: 'States Covered' },
  { number: '100%', label: 'Verified Families' },
]

const steps = [
  { step: '01', title: 'Register', desc: 'Create your account with mobile or email verification.' },
  { step: '02', title: 'Join Your Family', desc: 'Find your existing family or register a new one.' },
  { step: '03', title: 'Build Your Tree', desc: 'Add family members, relationships, and photographs.' },
  { step: '04', title: 'Connect', desc: 'Engage with the Ladwani community across the platform.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-saffron-500 to-saffron-700 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-lg">म</span>
              </div>
              <div>
                <div className="font-bold text-gray-900 leading-tight">Mi Ladwani</div>
                <div className="text-xs text-gray-500 leading-tight">Ladwani Samaj</div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
              <a href="#features" className="hover:text-saffron-600 transition-colors">Features</a>
              <a href="#about" className="hover:text-saffron-600 transition-colors">About</a>
              <a href="#how-it-works" className="hover:text-saffron-600 transition-colors">How It Works</a>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                Join Community
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-saffron-50 via-orange-50 to-amber-50">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-saffron-200 rounded-full opacity-20 blur-3xl" />
          <div className="absolute bottom-0 -left-24 w-80 h-80 bg-orange-200 rounded-full opacity-20 blur-3xl" />
        </div>

        {/* Decorative border pattern */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-saffron-400 via-orange-500 to-amber-400" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-saffron-100 text-saffron-800 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <Star className="w-3.5 h-3.5" />
              Official Digital Platform — Ladwani Samaj
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 font-display leading-tight mb-6">
              Our Community,{' '}
              <span className="text-saffron-600">Our Heritage,</span>{' '}
              Our Future
            </h1>

            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              The trusted digital home for every Ladwani family. Manage your family tree, 
              connect with community members, and discover matrimonial matches — all in one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="btn-primary text-base px-8 py-3 flex items-center gap-2 justify-center">
                Join Your Community
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="btn-secondary text-base px-8 py-3 flex items-center gap-2 justify-center">
                Sign In
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-green-500" /> Verified families only</span>
              <span className="flex items-center gap-1.5"><Globe2 className="w-4 h-4 text-blue-500" /> Members across India</span>
              <span className="flex items-center gap-1.5"><Heart className="w-4 h-4 text-pink-500" /> Privacy-first matrimony</span>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 30C360 60 1080 0 1440 30V60H0V30Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-saffron-600 font-display">{s.number}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-saffron-200 to-transparent" />
      </div>

      {/* Features */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="section-heading">Everything Your Community Needs</h2>
            <p className="section-subheading max-w-2xl mx-auto">
              A complete platform built with deep respect for Indian family values and community traditions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card-hover group">
                <div className={`w-12 h-12 ${f.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gradient-to-br from-saffron-50 to-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="section-heading">Getting Started Is Simple</h2>
            <p className="section-subheading">Join thousands of Ladwani families already on the platform.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.step} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-saffron-200" />
                )}
                <div className="relative z-10 w-16 h-16 bg-white border-2 border-saffron-300 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <span className="text-2xl font-bold text-saffron-600 font-display">{s.step}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="badge-orange mb-4">About Ladwani Samaj</div>
              <h2 className="section-heading mb-4">
                A Community Built on Trust, Family, and Tradition
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                The Ladwani Samaj is a proud Indian community with deep roots across Maharashtra and beyond. 
                Mi Ladwani is our official digital platform — built to preserve our heritage, strengthen our bonds, 
                and help our families thrive in the modern world.
              </p>
              <div className="space-y-3">
                {[
                  'Complete family tree management across generations',
                  'Verified member directory with privacy controls',
                  'Trusted matrimonial discovery within the community',
                  'Community announcements, events, and achievements',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 bg-saffron-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 bg-saffron-500 rounded-full" />
                    </div>
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link href="/register" className="btn-primary inline-flex items-center gap-2">
                  Join the Platform
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="bg-gradient-to-br from-saffron-50 to-amber-50 rounded-2xl p-8">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Building2, label: 'Native Villages', value: 'Tracked & Preserved' },
                  { icon: Users, label: 'Multi-Generation', value: 'Family Histories' },
                  { icon: MapPin, label: 'Members in', value: 'Multiple States' },
                  { icon: Heart, label: 'Matrimonial', value: 'Success Stories' },
                ].map((item) => (
                  <div key={item.label} className="bg-white rounded-xl p-4 text-center shadow-sm">
                    <div className="w-10 h-10 bg-saffron-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <item.icon className="w-5 h-5 text-saffron-600" />
                    </div>
                    <div className="text-xs font-medium text-gray-500">{item.label}</div>
                    <div className="text-sm font-semibold text-gray-900 mt-0.5">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-saffron-600 to-orange-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white font-display mb-4">
            Ready to Connect with Your Community?
          </h2>
          <p className="text-saffron-100 text-lg mb-8">
            Join thousands of Ladwani families who are already connected on Mi Ladwani.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-white text-saffron-700 font-semibold px-8 py-3 rounded-xl hover:bg-saffron-50 transition-colors shadow-lg"
            >
              Create Your Account
            </Link>
            <Link
              href="/login"
              className="border-2 border-white text-white font-semibold px-8 py-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-saffron-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">म</span>
                </div>
                <span className="font-bold text-white">Mi Ladwani</span>
              </div>
              <p className="text-sm leading-relaxed">
                Official digital platform for the Ladwani Samaj community.
              </p>
            </div>
            <div>
              <h4 className="text-white font-medium mb-3 text-sm">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Register</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-3 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-3 text-sm">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>Ladwani Samaj</li>
                <li>Maharashtra, India</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-sm text-center">
            © {new Date().getFullYear()} Mi Ladwani — Ladwani Samaj. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
