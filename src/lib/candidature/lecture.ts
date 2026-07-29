import type { SupabaseClient } from '@supabase/supabase-js'
import type { Candidature, CandidatureContenu } from './types'

export async function getCandidature(
  client: SupabaseClient,
  userId: string,
  offreId: string,
): Promise<Candidature | null> {
  const { data, error } = await client
    .from('candidatures')
    .select('user_id, offre_id, email_objet, email_corps, lettre, statut')
    .eq('user_id', userId)
    .eq('offre_id', offreId)
    .single()
  // PGRST116 = aucune ligne : pas encore de candidature pour cette offre.
  if (error && error.code !== 'PGRST116') throw error
  return (data as Candidature) ?? null
}

export async function upsertCandidature(
  client: SupabaseClient,
  userId: string,
  offreId: string,
  contenu: CandidatureContenu,
): Promise<Candidature> {
  const { data, error } = await client
    .from('candidatures')
    .upsert(
      {
        user_id: userId,
        offre_id: offreId,
        email_objet: contenu.email_objet,
        email_corps: contenu.email_corps,
        lettre: contenu.lettre,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,offre_id' },
    )
    .select('user_id, offre_id, email_objet, email_corps, lettre, statut')
    .single()
  if (error) throw error
  return data as Candidature
}
