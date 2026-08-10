import type { SupabaseClient } from '@supabase/supabase-js'
import { chunk } from '@/lib/chunk'

// Taille de lot pour le filtre .in(offre_id, [...]) : borne la longueur de l'URL
// PostgREST bien sous la limite de ~16 Ko d'undici (voir lib/chunk).
const TAILLE_LOT = 100

export async function getScores(
  client: SupabaseClient, userId: string, offreIds: string[],
): Promise<Map<string, { score: number; raison: string | null }>> {
  const map = new Map<string, { score: number; raison: string | null }>()
  if (offreIds.length === 0) return map
  // Une recherche peut lier des centaines d'offres : on découpe le .in() en lots
  // pour ne pas dépasser la taille d'URL acceptée (sinon fetch échoue côté serveur).
  const lots = await Promise.all(
    chunk(offreIds, TAILLE_LOT).map((lot) =>
      client.from('scores').select('offre_id, score, raison').eq('user_id', userId).in('offre_id', lot),
    ),
  )
  for (const { data, error } of lots) {
    if (error) throw error
    for (const r of (data ?? []) as { offre_id: string; score: number; raison: string | null }[]) {
      map.set(r.offre_id, { score: Math.max(0, Math.min(100, r.score)), raison: r.raison })
    }
  }
  return map
}
