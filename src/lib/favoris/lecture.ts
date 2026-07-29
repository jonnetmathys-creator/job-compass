import type { SupabaseClient } from '@supabase/supabase-js'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import { sortByDateDesc } from '@/lib/recherche/offres'

export async function getFavoriIds(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from('favoris').select('offre_id').eq('user_id', userId)
  if (error) throw error
  if (!data) return []
  return data.map((r: { offre_id: string }) => r.offre_id)
}

export async function getFavoris(client: SupabaseClient, userId: string): Promise<OffreRow[]> {
  const { data, error } = await client
    .from('favoris')
    .select(`offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('user_id', userId)
  if (error) throw error
  if (!data) return []
  const offres = data
    .map((r: { offres: OffreRow | OffreRow[] }) => (Array.isArray(r.offres) ? r.offres[0] : r.offres))
    .filter(Boolean) as OffreRow[]
  return sortByDateDesc(offres)
}
