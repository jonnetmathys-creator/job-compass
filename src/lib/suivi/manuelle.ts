import type { SupabaseClient } from '@supabase/supabase-js'
import { ajouterJours } from './dates'
import { urlPostulerSure } from '@/lib/offres/url'

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
      titre: form.titre.slice(0, 200),
      entreprise: form.entreprise ? form.entreprise.slice(0, 200) : null,
      ville: form.ville ? form.ville.slice(0, 120) : null,
      url_postuler: urlPostulerSure(form.url),
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
