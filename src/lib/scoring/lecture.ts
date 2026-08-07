import type { SupabaseClient } from '@supabase/supabase-js'

export async function getScores(
  client: SupabaseClient, userId: string, offreIds: string[],
): Promise<Map<string, { score: number; raison: string | null }>> {
  const map = new Map<string, { score: number; raison: string | null }>()
  if (offreIds.length === 0) return map
  const { data, error } = await client
    .from('scores').select('offre_id, score, raison')
    .eq('user_id', userId).in('offre_id', offreIds)
  if (error) throw error
  for (const r of (data ?? []) as { offre_id: string; score: number; raison: string | null }[]) {
    map.set(r.offre_id, { score: Math.max(0, Math.min(100, r.score)), raison: r.raison })
  }
  return map
}
