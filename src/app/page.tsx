import type { Viewport } from 'next'
import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getRecherches } from '@/lib/recherche/liste'
import AccueilClient from '@/components/accueil-client'

// Accueil : on laisse le zoom par pincement actif (accessibilité, WCAG 1.4.4).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#248049',
  viewportFit: 'cover',
}

export default async function Home() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // Recherches enregistrées : révélées via le tiroir déroulant sous le hero.
  // Sans recherche, le tiroir (et sa poignée) n'apparaissent pas : accueil inchangé.
  const recherches = await getRecherches(supabase, user.id).catch(() => [])
  return <AccueilClient recherches={recherches} />
}
