import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/service'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import { getFavoriIds } from '@/lib/favoris/lecture'
import { getCandidature } from '@/lib/candidature/lecture'
import OffreDetail from '@/components/offre-detail'

// Nettoie une description (source tierce) pour l'aperçu : espaces normalisés + coupe courte.
function extrait(texte: string | null, max = 155): string {
  const t = (texte ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const service = getServiceClient()
  const { data: offre } = await service
    .from('offres').select('titre, entreprise, ville, description').eq('id', id).single()
  if (!offre) return { title: 'Offre introuvable · JobCompass' }
  const lieu = offre.ville ? ` · ${offre.ville}` : ''
  const titre = `${offre.titre}${offre.entreprise ? ` · ${offre.entreprise}` : ''}${lieu}`
  const desc = extrait(offre.description) || 'Découvrez cette offre en diététique sur JobCompass.'
  return {
    title: `${offre.titre} · JobCompass`,
    description: desc,
    openGraph: {
      title: titre,
      description: desc,
      url: `/offre/${id}`,
      siteName: 'JobCompass',
      locale: 'fr_FR',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: titre, description: desc },
  }
}

export default async function OffrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: offre } = await supabase.from('offres').select(OFFRE_COLUMNS).eq('id', id).single()
    if (!offre) notFound()
    const [favoriIds, candidature] = await Promise.all([
      getFavoriIds(supabase, user.id),
      getCandidature(supabase, user.id, id),
    ])
    return <OffreDetail offre={offre as OffreRow} likedInitial={favoriIds.includes(id)} statutSuivi={candidature?.statut ?? 'brouillon'} />
  }

  // Visiteur non connecté : lecture publique (les offres sont des annonces publiques).
  // Le service bypass RLS ; la page affiche l'offre complète + une invite à s'inscrire.
  const service = getServiceClient()
  const { data: offre } = await service.from('offres').select(OFFRE_COLUMNS).eq('id', id).single()
  if (!offre) notFound()
  return <OffreDetail offre={offre as OffreRow} likedInitial={false} statutSuivi="brouillon" anon />
}
