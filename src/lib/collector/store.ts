import type { SupabaseClient } from '@supabase/supabase-js'
import type { NormalizedOffer } from './types'

export type StoredOffre = { id: string; source: string; source_id: string }

export async function storeOffres(
  client: SupabaseClient,
  offres: NormalizedOffer[],
): Promise<StoredOffre[]> {
  if (offres.length === 0) return []
  const now = new Date().toISOString()
  const rows = offres.map((o) => ({ ...o, date_collecte: now }))
  const { data, error } = await client
    .from('offres')
    .upsert(rows, { onConflict: 'source,source_id' })
    .select('id, source, source_id')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    source: r.source as string,
    source_id: r.source_id as string,
  }))
}

export async function linkResultats(
  client: SupabaseClient,
  rechercheId: string,
  stored: StoredOffre[],
): Promise<void> {
  if (stored.length === 0) return
  const rows = stored.map((s) => ({ recherche_id: rechercheId, offre_id: s.id }))
  // ignoreDuplicates : ne touche pas une ligne existante (donc ne remet pas score_pertinence à null)
  const { error } = await client
    .from('resultats')
    .upsert(rows, { onConflict: 'recherche_id,offre_id', ignoreDuplicates: true })
  if (error) throw error
}
