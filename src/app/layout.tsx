import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'
import OnboardingTour from '@/components/onboarding-tour'
import PwaSetup from '@/components/pwa-setup'
import BottomNav from '@/components/bottom-nav'
import SplashScreen from '@/components/splash-screen'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://job-compass-pldk.onrender.com'),
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
  viewportFit: 'cover', // le fond va jusqu'aux bords ; on gère les zones sûres en CSS (env safe-area)
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body>
        {children}
        <SplashScreen />
        <BottomNav />
        <OnboardingTour />
        <PwaSetup />
      </body>
    </html>
  )
}
