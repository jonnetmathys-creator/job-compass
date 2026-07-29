import type { SupabaseClient } from '@supabase/supabase-js'
import { ajouterJours } from './dates'

export type FormManuelle = {
  titre: string
  entreprise: string
  ville: string
  url: string
  dateIso: string
}

export async function creerCandidatureManuelle(
  client: SupabaseClient,
  userId: string,
  form: FormManuelle,
): Promise<string> {
  const { data, error } = await client
    .from('offres')
    .insert({
      source: 'manuelle',
      source_id: crypto.randomUUID(),
      created_by: userId,
      titre: form.titre,
      entreprise: form.entreprise || null,
      ville: form.ville || null,
      url_postuler: form.url || null,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('Création de l\'offre manuelle échouée')
  const offreId = data.id as string

  const { error: e2 } = await client.from('candidatures').insert({
    user_id: userId,
    offre_id: offreId,
    statut: 'postulee',
    postulee_le: form.dateIso,
    relance_le: ajouterJours(form.dateIso, 10),
  })
  if (e2) throw e2
  return offreId
}
