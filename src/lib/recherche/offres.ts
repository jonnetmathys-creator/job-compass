import type { SupabaseClient } from '@supabase/supabase-js'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'

export function sortByDateDesc(offres: OffreRow[]): OffreRow[] {
  return [...offres].sort((a, b) => {
    if (!a.date_publication && !b.date_publication) return 0
    if (!a.date_publication) return 1
    if (!b.date_publication) return -1
    return b.date_publication.localeCompare(a.date_publication)
  })
}

export async function getRecherche(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from('recherches')
    .select('id, intitule, localisation, rayon_km, type_contrat, latitude, longitude, lieu_label, alertes_email')
    .eq('id', id)
    .single()
  // PGRST116 = aucune ligne (recherche introuvable) : on renvoie null. Toute autre
  // erreur (réseau, RLS...) est relancée pour ne pas la confondre avec un 404.
  if (error && error.code !== 'PGRST116') throw error
  return (data as
    | {
        id: string; intitule: string; localisation: string | null; rayon_km: number | null
        type_contrat: string | null; latitude: number | null; longitude: number | null
        lieu_label: string | null; alertes_email: boolean
      }
    | null) ?? null
}

export async function getOffresForRecherche(client: SupabaseClient, rechercheId: string): Promise<OffreRow[]> {
  const { data, error } = await client
    .from('resultats')
    .select(`offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('recherche_id', rechercheId)
  if (error) throw error
  if (!data) return []
  const offres = data.map((r: { offres: OffreRow | OffreRow[] }) => (Array.isArray(r.offres) ? r.offres[0] : r.offres)).filter(Boolean) as OffreRow[]
  return sortByDateDesc(offres)
}
