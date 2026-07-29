import type { SupabaseClient } from '@supabase/supabase-js'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import type { StatutSuivi } from './statuts'

export type CandidatureSuivi = {
  offre: OffreRow
  statut: string
  postulee_le: string | null
  relance_le: string | null
  notes: string | null
}

export async function getSuivi(client: SupabaseClient, userId: string): Promise<CandidatureSuivi[]> {
  const { data, error } = await client
    .from('candidatures')
    .select(`statut, postulee_le, relance_le, notes, offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('user_id', userId)
    .neq('statut', 'brouillon')
  if (error) throw error
  if (!data) return []
  const items = data
    .map((r: any) => {
      const offre = (Array.isArray(r.offres) ? r.offres[0] : r.offres) as OffreRow | null
      if (!offre) return null
      return { offre, statut: r.statut, postulee_le: r.postulee_le ?? null, relance_le: r.relance_le ?? null, notes: r.notes ?? null }
    })
    .filter(Boolean) as CandidatureSuivi[]
  // tri par date de candidature décroissante, nulls en fin
  return items.sort((a, b) => {
    if (!a.postulee_le && !b.postulee_le) return 0
    if (!a.postulee_le) return 1
    if (!b.postulee_le) return -1
    return b.postulee_le.localeCompare(a.postulee_le)
  })
}

async function majCandidature(
  client: SupabaseClient,
  userId: string,
  offreId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from('candidatures')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('offre_id', offreId)
  if (error) throw error
}

// Marque « postulée » sans écraser une date de candidature déjà posée.
export async function setPostulee(client: SupabaseClient, userId: string, offreId: string, dateIso: string): Promise<void> {
  await majCandidature(client, userId, offreId, { statut: 'postulee' })
  const { error } = await client
    .from('candidatures')
    .update({ postulee_le: dateIso })
    .eq('user_id', userId)
    .eq('offre_id', offreId)
    .is('postulee_le', null)
  if (error) throw error
}

export async function clearSuivi(client: SupabaseClient, userId: string, offreId: string): Promise<void> {
  await majCandidature(client, userId, offreId, { statut: 'brouillon', postulee_le: null })
}

export async function setStatut(client: SupabaseClient, userId: string, offreId: string, statut: StatutSuivi): Promise<void> {
  await majCandidature(client, userId, offreId, { statut })
}

export async function setDetailsSuivi(
  client: SupabaseClient,
  userId: string,
  offreId: string,
  patch: { notes: string | null; relance_le: string | null },
): Promise<void> {
  await majCandidature(client, userId, offreId, { notes: patch.notes, relance_le: patch.relance_le })
}
