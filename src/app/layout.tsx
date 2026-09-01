import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import SessionProvider from '@/components/shared/SessionProvider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Mi Ladwani — Community Platform',
    template: '%s | Mi Ladwani',
  },
  description:
    'Official family registry, directory, and matrimony platform for the Ladwani Samaj community.',
  keywords: ['Ladwani', 'Ladwani Samaj', 'community', 'family registry', 'matrimony'],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://devmiladwani.agtci.com',
    siteName: 'Mi Ladwani',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased min-h-screen bg-amber-50/30">
        <SessionProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: '#363636', color: '#fff' },
              success: { style: { background: '#15803d', color: '#fff' } },
              error: { style: { background: '#dc2626', color: '#fff' } },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  )
}
