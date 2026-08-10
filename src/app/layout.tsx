import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'
import OnboardingTour from '@/components/onboarding-tour'
import PwaSetup from '@/components/pwa-setup'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'JobCompass',
  description: 'Centralisez et envoyez vos candidatures en diététique.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'JobCompass' },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#248049',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body>
        {children}
        <OnboardingTour />
        <PwaSetup />
      </body>
    </html>
  )
}
