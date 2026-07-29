import type { SupabaseClient } from '@supabase/supabase-js'
import { collectForRecherche } from '@/lib/collector/collect'
import type { RechercheRow } from '@/lib/collector/types'

export async function offreIdsLies(client: SupabaseClient, rechercheId: string): Promise<Set<string>> {
  const { data, error } = await client.from('resultats').select('offre_id').eq('recherche_id', rechercheId)
  if (error) throw error
  return new Set((data ?? []).map((r: { offre_id: string }) => r.offre_id))
}

export async function rafraichirRecherche(
  client: SupabaseClient,
  recherche: RechercheRow & { id: string },
  deps: { collect?: typeof collectForRecherche } = {},
): Promise<{ nouvelles: string[] }> {
  const collect = deps.collect ?? collectForRecherche
  const avant = await offreIdsLies(client, recherche.id)
  await collect(client, recherche)
  const apres = await offreIdsLies(client, recherche.id)
  const nouvelles = [...apres].filter((id) => !avant.has(id))
  await client.from('recherches').update({ derniere_collecte: new Date().toISOString() }).eq('id', recherche.id)
  return { nouvelles }
}

export async function enregistrerNouvelles(
  client: SupabaseClient,
  userId: string,
  rechercheId: string,
  offreIds: string[],
): Promise<number> {
  if (offreIds.length === 0) return 0
  const rows = offreIds.map((offre_id) => ({ user_id: userId, offre_id, recherche_id: rechercheId }))
  const { data, error } = await client
    .from('nouvelles_offres')
    .upsert(rows, { onConflict: 'user_id,offre_id', ignoreDuplicates: true })
    .select('offre_id')
  if (error) throw error
  return (data ?? []).length
}
