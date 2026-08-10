import type { SupabaseClient } from '@supabase/supabase-js'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import { getScores } from '@/lib/scoring/lecture'
import { estTopMatch } from '@/lib/scoring/palette'

export type NouvelleOffre = { offre: OffreRow; created_at: string; vue_le: string | null; score?: number; raison?: string | null }

export const FENETRE_NOTIF_JOURS = 30

function cutoffFenetre(): string {
  return new Date(Date.now() - FENETRE_NOTIF_JOURS * 24 * 60 * 60 * 1000).toISOString()
}

export async function getBoite(
  client: SupabaseClient, userId: string, deps: { getScores?: typeof getScores } = {},
): Promise<NouvelleOffre[]> {
  const { data, error } = await client
    .from('nouvelles_offres')
    .select(`created_at, vue_le, offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('user_id', userId)
    .is('vue_le', null)
    .gt('created_at', cutoffFenetre())
  if (error) throw error
  if (!data) return []
  const items = data
    .map((r: any) => {
      const offre = (Array.isArray(r.offres) ? r.offres[0] : r.offres) as OffreRow | null
      if (!offre) return null
      return { offre, created_at: r.created_at, vue_le: r.vue_le ?? null } as NouvelleOffre
    })
    .filter(Boolean) as NouvelleOffre[]

  // Joint les scores et remonte les « top match » (>= 90) en tête, puis par date.
  const lireScores = deps.getScores ?? getScores
  const scores = await lireScores(client, userId, items.map((i) => i.offre.id))
  for (const it of items) {
    const s = scores.get(it.offre.id)
    if (s) { it.score = s.score; it.raison = s.raison }
  }
  return items.sort((a, b) => {
    const ta = estTopMatch(a.score ?? 0) ? 1 : 0
    const tb = estTopMatch(b.score ?? 0) ? 1 : 0
    if (ta !== tb) return tb - ta
    return b.created_at.localeCompare(a.created_at)
  })
}

export async function compterNonVues(client: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await client
    .from('nouvelles_offres')
    .select('offre_id')
    .eq('user_id', userId)
    .is('vue_le', null)
    .gt('created_at', cutoffFenetre())
  if (error) throw error
  return (data ?? []).length
}

// Marque toutes les notifications non vues de l'utilisateur comme vues (vider la cloche).
export async function marquerToutesVues(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client
    .from('nouvelles_offres')
    .update({ vue_le: new Date().toISOString() })
    .eq('user_id', userId)
    .is('vue_le', null)
  if (error) throw error
}

export async function marquerOffreVue(client: SupabaseClient, userId: string, offreId: string): Promise<void> {
  const { error } = await client
    .from('nouvelles_offres')
    .update({ vue_le: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('offre_id', offreId)
    .is('vue_le', null)
  if (error) throw error
}
