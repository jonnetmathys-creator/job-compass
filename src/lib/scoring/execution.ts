import type { SupabaseClient } from '@supabase/supabase-js'
import { chunk } from '@/lib/chunk'
import { empreinteOffre } from '@/lib/offres/dedup-affichage'
import { getProfil } from '@/lib/profil'
import { assurerCvTexte } from './cv'
import { scorerOffres, type OffreANoter, type Note } from './scorer'

type OffreDb = { id: string; titre: string; entreprise: string | null; ville: string | null; contrat: string | null; description: string | null }

// Regroupe par empreinte les offres non notées ; renvoie une offre par groupe (ref = 1er id)
// plus la liste complète des ids de chaque groupe.
export function preparerNotation(
  offres: OffreDb[], dejaNotes: Set<string>,
): { aNoter: OffreANoter[]; membres: Map<string, string[]> } {
  const aNoter: OffreANoter[] = []
  const membres = new Map<string, string[]>()
  const refParEmpreinte = new Map<string, string>()
  for (const o of offres) {
    if (dejaNotes.has(o.id)) continue
    const emp = empreinteOffre(o)
    const ref = refParEmpreinte.get(emp)
    if (ref) { membres.get(ref)!.push(o.id); continue }
    refParEmpreinte.set(emp, o.id)
    membres.set(o.id, [o.id])
    aNoter.push({ ref: o.id, titre: o.titre, entreprise: o.entreprise, ville: o.ville, contrat: o.contrat, description: o.description })
  }
  return { aNoter, membres }
}

export function lignesScores(
  userId: string, membres: Map<string, string[]>, notes: Map<string, Note>,
): { user_id: string; offre_id: string; score: number; raison: string }[] {
  const rows: { user_id: string; offre_id: string; score: number; raison: string }[] = []
  for (const [ref, ids] of membres) {
    const note = notes.get(ref)
    if (!note) continue
    const score = Math.max(0, Math.min(100, Math.round(note.score)))
    for (const offre_id of ids) rows.push({ user_id: userId, offre_id, score, raison: note.raison })
  }
  return rows
}

type Recherche = { id: string; user_id: string }
type Deps = { scorer?: typeof scorerOffres }

// Note les offres non encore notées d'une recherche pour son propriétaire. Retour : nombre de scores écrits.
export async function scorerPourRecherche(client: SupabaseClient, recherche: Recherche, deps: Deps = {}): Promise<number> {
  const scorer = deps.scorer ?? scorerOffres
  const profil = await getProfil(client, recherche.user_id)
  if (!profil) return 0
  const cvTexte = await assurerCvTexte(client, recherche.user_id, profil)
  if (!cvTexte) return 0

  const { data: liees } = await client
    .from('resultats')
    .select('offres:offre_id (id, titre, entreprise, ville, contrat, description)')
    .eq('recherche_id', recherche.id)
  const offres = (liees ?? [])
    .map((r: any) => (Array.isArray(r.offres) ? r.offres[0] : r.offres))
    .filter(Boolean) as OffreDb[]
  if (offres.length === 0) return 0

  // Découpe le .in() en lots : une recherche peut lier des centaines d'offres, et
  // une URL PostgREST trop longue (> ~16 Ko) fait échouer le fetch côté serveur.
  const dejaNotes = new Set<string>()
  for (const lot of chunk(offres.map((o) => o.id), 100)) {
    const { data: dejaData } = await client
      .from('scores').select('offre_id').eq('user_id', recherche.user_id).in('offre_id', lot)
    for (const r of (dejaData ?? []) as { offre_id: string }[]) dejaNotes.add(r.offre_id)
  }

  const { aNoter, membres } = preparerNotation(offres, dejaNotes)
  if (aNoter.length === 0) return 0

  const notesArr = await scorer(cvTexte, aNoter)
  const notes = new Map(notesArr.map((n) => [n.ref, n]))
  const rows = lignesScores(recherche.user_id, membres, notes)
  if (rows.length === 0) return 0

  const { error } = await client.from('scores').upsert(rows, { onConflict: 'user_id,offre_id', ignoreDuplicates: true })
  if (error) throw error
  return rows.length
}
