import type { SupabaseClient } from '@supabase/supabase-js'

const JOURS_RETENTION = 30

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
  const { error: errDel } = await client.from('offres').delete().in('id', ids)
  if (errDel) throw errDel
  return ids.length
}
