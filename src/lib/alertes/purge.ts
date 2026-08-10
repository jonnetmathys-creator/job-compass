import type { SupabaseClient } from '@supabase/supabase-js'
import { chunk } from '@/lib/chunk'

const JOURS_RETENTION = 30
const JOURS_RETENTION_NOTIFS = 30 // durée de vie d'une notification dans la cloche

type OffreCandidate = { id: string; date_collecte: string | null; created_by: string | null }

export function offresAPurger(input: {
  offres: OffreCandidate[]
  protegees: Set<string>
  cutoffISO: string
}): string[] {
  return input.offres
    .filter((o) =>
      o.date_collecte != null &&
      o.date_collecte < input.cutoffISO &&
      o.created_by == null &&
      !input.protegees.has(o.id))
    .map((o) => o.id)
}

// Offres auxquelles un utilisateur tient (likées, en candidature, avec rappel) : jamais purgées.
async function idsProteges(client: SupabaseClient): Promise<Set<string>> {
  const tables = ['favoris', 'candidatures', 'rappels']
  const listes = await Promise.all(
    tables.map((t) => client.from(t).select('offre_id')),
  )
  const set = new Set<string>()
  for (const { data } of listes) {
    for (const row of (data ?? []) as { offre_id: string }[]) set.add(row.offre_id)
  }
  return set
}

export async function purgerVieillesOffres(client: SupabaseClient, jours = JOURS_RETENTION): Promise<number> {
  const cutoffISO = new Date(Date.now() - jours * 24 * 60 * 60 * 1000).toISOString()

  const { data: offres, error } = await client
    .from('offres')
    .select('id, date_collecte, created_by')
    .lt('date_collecte', cutoffISO)
  if (error) throw error

  const protegees = await idsProteges(client)
  const ids = offresAPurger({ offres: (offres ?? []) as OffreCandidate[], protegees, cutoffISO })
  if (ids.length === 0) return 0

  // resultats et nouvelles_offres liées partent en cascade (données dérivées).
  // Découpe en lots : supprimer des centaines d'ids via .in() dépasserait la
  // taille d'URL PostgREST acceptée (fetch échoue au-delà de ~16 Ko).
  for (const lot of chunk(ids, 100)) {
    const { error: errDel } = await client.from('offres').delete().in('id', lot)
    if (errDel) throw errDel
  }
  return ids.length
}

// Supprime les vieilles notifications de la cloche (au-delà de la fenêtre d'affichage),
// pour ne pas laisser la table enfler indéfiniment. Retour : nombre supprimé.
export async function purgerVieillesNotifs(client: SupabaseClient, jours = JOURS_RETENTION_NOTIFS): Promise<number> {
  const cutoffISO = new Date(Date.now() - jours * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await client
    .from('nouvelles_offres')
    .delete()
    .lt('created_at', cutoffISO)
    .select('offre_id')
  if (error) throw error
  return (data ?? []).length
}
