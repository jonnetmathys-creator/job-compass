import { notFound, redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import { getFavoriIds } from '@/lib/favoris/lecture'
import { getCandidature } from '@/lib/candidature/lecture'
import OffreDetail from '@/components/offre-detail'

export default async function OffrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: offre } = await supabase.from('offres').select(OFFRE_COLUMNS).eq('id', id).single()
  if (!offre) notFound()
  const [favoriIds, candidature] = await Promise.all([
    getFavoriIds(supabase, user.id),
    getCandidature(supabase, user.id, id),
  ])
  return <OffreDetail offre={offre as OffreRow} likedInitial={favoriIds.includes(id)} statutSuivi={candidature?.statut ?? 'brouillon'} />
}
