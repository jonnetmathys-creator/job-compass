import type { Viewport } from 'next'
import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import SearchBar from '@/components/search-bar'
import HeaderActions from '@/components/header-actions'

// Accueil : on verrouille le zoom par pincement (ressenti app). Effectif en PWA
// installée ; iOS Safari (onglet) ignore volontairement ce réglage pour l'accessibilité.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#248049',
  viewportFit: 'cover',
}

export default async function Home() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <main className="home-main">
      <div className="home-actions"><HeaderActions /></div>
      <div className="decor" aria-hidden>
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
        <div className="ring r1" /><div className="ring r2" />
        <svg className="compass" width="150" height="150" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="34" />
          <polygon points="50,20 58,50 50,80 42,50" fill="currentColor" stroke="none" opacity=".7" />
          <circle cx="50" cy="50" r="3" fill="currentColor" stroke="none" />
        </svg>
        <svg className="dotgrid" width="120" height="120" viewBox="0 0 120 120" fill="currentColor">
          <circle cx="10" cy="10" r="2" /><circle cx="40" cy="10" r="2" /><circle cx="70" cy="10" r="2" /><circle cx="100" cy="10" r="2" />
          <circle cx="10" cy="40" r="2" /><circle cx="40" cy="40" r="2" /><circle cx="70" cy="40" r="2" /><circle cx="100" cy="40" r="2" />
          <circle cx="10" cy="70" r="2" /><circle cx="40" cy="70" r="2" /><circle cx="70" cy="70" r="2" /><circle cx="100" cy="70" r="2" />
          <circle cx="10" cy="100" r="2" /><circle cx="40" cy="100" r="2" /><circle cx="70" cy="100" r="2" /><circle cx="100" cy="100" r="2" />
        </svg>
      </div>
      <SearchBar />
    </main>
  )
}
