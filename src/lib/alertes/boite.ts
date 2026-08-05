import type { SupabaseClient } from '@supabase/supabase-js'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'

export type NouvelleOffre = { offre: OffreRow; created_at: string; vue_le: string | null }

export const FENETRE_NOTIF_JOURS = 30

function cutoffFenetre(): string {
  return new Date(Date.now() - FENETRE_NOTIF_JOURS * 24 * 60 * 60 * 1000).toISOString()
}

export async function getBoite(client: SupabaseClient, userId: string): Promise<NouvelleOffre[]> {
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
      return { offre, created_at: r.created_at, vue_le: r.vue_le ?? null }
    })
    .filter(Boolean) as NouvelleOffre[]
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at))
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

export async function marquerOffreVue(client: SupabaseClient, userId: string, offreId: string): Promise<void> {
  const { error } = await client
    .from('nouvelles_offres')
    .update({ vue_le: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('offre_id', offreId)
    .is('vue_le', null)
  if (error) throw error
}
