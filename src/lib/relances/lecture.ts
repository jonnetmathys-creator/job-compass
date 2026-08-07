import type { SupabaseClient } from '@supabase/supabase-js'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import { etatRelance } from './etat'

export type RelanceDue = {
  offre: OffreRow
  postulee_le: string | null
  relance_le: string
  nonVu: boolean
}

type Brut = {
  postulee_le: string | null
  relance_le: string | null
  relance_vue_le: string | null
  offres: OffreRow | OffreRow[] | null
}

// Candidatures « postulee » dont la relance est due (relance_le atteinte), jointes
// à l'offre, avec l'état vu/non-vu. Contrairement aux rappels de consultation, on ne
// vérifie PAS la disponibilité de l'offre : une candidature déjà envoyée se relance
// même si l'annonce a été retirée.
export async function getRelancesDues(
  client: SupabaseClient,
  userId: string,
  todayIso: string,
  nowMs: number,
): Promise<{ items: RelanceDue[]; nonVus: number }> {
  const { data, error } = await client
    .from('candidatures')
    .select(`postulee_le, relance_le, relance_vue_le, offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('user_id', userId)
    .eq('statut', 'postulee')
    .not('relance_le', 'is', null)
    .lte('relance_le', todayIso)
  if (error || !data) return { items: [], nonVus: 0 }

  const items: RelanceDue[] = []
  for (const r of data as Brut[]) {
    const offre = (Array.isArray(r.offres) ? r.offres[0] : r.offres) as OffreRow | null
    if (!offre || !r.relance_le) continue
    const etat = etatRelance(r.relance_le, r.relance_vue_le, todayIso, nowMs)
    if (!etat.visible) continue
    items.push({ offre, postulee_le: r.postulee_le ?? null, relance_le: r.relance_le, nonVu: etat.nonVu })
  }
  // Plus en retard d'abord (relance_le la plus ancienne en tête).
  items.sort((a, b) => a.relance_le.localeCompare(b.relance_le))
  return { items, nonVus: items.filter((i) => i.nonVu).length }
}
