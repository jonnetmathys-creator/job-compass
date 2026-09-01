import type { SupabaseClient } from '@supabase/supabase-js'

export type RechercheResume = {
  id: string
  intitule: string
  lieu_label: string | null
  rayon_km: number | null
  type_contrat: string | null
  alertes_email: boolean
  derniere_collecte: string | null
  nb_offres: number
}

// Recherches enregistrées de l'utilisateur, la plus récemment collectée d'abord,
// avec le nombre d'offres liées (un count léger par recherche, N petit).
export async function getRecherches(client: SupabaseClient, userId: string): Promise<RechercheResume[]> {
  const { data, error } = await client
    .from('recherches')
    .select('id, intitule, lieu_label, rayon_km, type_contrat, alertes_email, derniere_collecte, created_at')
    .eq('user_id', userId)
    .order('derniere_collecte', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  const lignes = data ?? []

  const compte = await Promise.all(
    lignes.map(async (r) => {
      const { count } = await client
        .from('resultats')
        .select('offre_id', { count: 'exact', head: true })
        .eq('recherche_id', r.id as string)
      return count ?? 0
    }),
  )

  return lignes.map((r, i) => ({
    id: r.id as string,
    intitule: r.intitule as string,
    lieu_label: (r.lieu_label as string | null) ?? null,
    rayon_km: (r.rayon_km as number | null) ?? null,
    type_contrat: (r.type_contrat as string | null) ?? null,
    alertes_email: Boolean(r.alertes_email),
    derniere_collecte: (r.derniere_collecte as string | null) ?? null,
    nb_offres: compte[i],
  }))
}
