import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'
import CompteMenu from '@/components/compte-menu'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'JobCompass',
  description: 'Centralisez et envoyez vos candidatures en diététique.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body>
        <CompteMenu />
        {children}
      </body>
    </html>
  )
}
