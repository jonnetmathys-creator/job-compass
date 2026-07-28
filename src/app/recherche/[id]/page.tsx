import { notFound, redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getRecherche, getOffresForRecherche } from '@/lib/recherche/offres'
import { getFavoriIds } from '@/lib/favoris/lecture'
import { filtrerDansRayon } from '@/lib/geo/distance'
import ResultatsShell from '@/components/resultats-shell'

export default async function RechercherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const recherche = await getRecherche(supabase, id)
  if (!recherche) notFound()
  const [offresBrutes, favoriIds] = await Promise.all([
    getOffresForRecherche(supabase, id),
    getFavoriIds(supabase, user.id),
  ])
  const offres = recherche.latitude != null && recherche.longitude != null && recherche.rayon_km != null
    ? filtrerDansRayon(offresBrutes, { lat: recherche.latitude, lng: recherche.longitude }, recherche.rayon_km)
    : offresBrutes
  return <ResultatsShell recherche={recherche} offres={offres} favoriIds={favoriIds} />
}
