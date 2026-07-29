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

// Marque « postulée » : crée la candidature si absente, promeut brouillon -> postulee
// sans rétrograder un statut plus avancé, et pose postulee_le / relance_le si absents.
export async function setPostulee(
  client: SupabaseClient,
  userId: string,
  offreId: string,
  dateIso: string,
  relanceIso: string,
): Promise<void> {
  const { error: e1 } = await client
    .from('candidatures')
    .upsert({ user_id: userId, offre_id: offreId }, { onConflict: 'user_id,offre_id', ignoreDuplicates: true })
  if (e1) throw e1
  const { error: e2 } = await client
    .from('candidatures')
    .update({ statut: 'postulee', updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('offre_id', offreId).eq('statut', 'brouillon')
  if (e2) throw e2
  const { error: e3 } = await client
    .from('candidatures')
    .update({ postulee_le: dateIso })
    .eq('user_id', userId).eq('offre_id', offreId).is('postulee_le', null)
  if (e3) throw e3
  const { error: e4 } = await client
    .from('candidatures')
    .update({ relance_le: relanceIso })
    .eq('user_id', userId).eq('offre_id', offreId).is('relance_le', null)
  if (e4) throw e4
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

export async function supprimerCandidature(client: SupabaseClient, userId: string, offreId: string): Promise<void> {
  // Récupère la source de l'offre avant suppression (pour nettoyer une offre manuelle).
  const { data: off } = await client.from('offres').select('source').eq('id', offreId).single()
  const { error } = await client.from('candidatures').delete().eq('user_id', userId).eq('offre_id', offreId)
  if (error) throw error
  if (off?.source === 'manuelle') {
    // RLS offres_delete_manuelle autorise la suppression d'une offre manuelle.
    await client.from('offres').delete().eq('id', offreId)
  }
}
