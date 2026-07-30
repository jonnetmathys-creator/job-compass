'use server'

import { getServerClient } from '@/lib/supabase/server'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import { ajouterJours, etatRappel, PREMIER_RAPPEL_JOURS, VERIF_TTL_MS } from './dates'
import { ftOffreDisponible } from './disponibilite'

export type RappelItem = { offre: OffreRow; consulte_le: string; nonVu: boolean }

// « Pas encore » : (ré)arme un rappel pour cette offre. Réinitialise l'échéance,
// ce qui remplace tout rappel précédent pour la même offre.
export async function enregistrerRappel(offreId: string): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const now = new Date().toISOString()
  const { error } = await supabase.from('rappels').upsert({
    user_id: user.id,
    offre_id: offreId,
    consulte_le: now,
    relance_le: ajouterJours(now, PREMIER_RAPPEL_JOURS),
    vue_le: null,
    statut: 'en_attente',
  }, { onConflict: 'user_id,offre_id' })
  if (error) throw error
}

// Le rappel a été consulté : passe en « vu » (réapparaîtra une semaine plus tard).
export async function marquerRappelVu(offreId: string): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('rappels')
    .update({ vue_le: new Date().toISOString() })
    .eq('user_id', user.id).eq('offre_id', offreId)
}

// L'utilisateur a postulé : le rappel n'a plus lieu d'être.
export async function cloreRappel(offreId: string): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('rappels')
    .update({ statut: 'postulee' })
    .eq('user_id', user.id).eq('offre_id', offreId)
}

type RappelBrut = {
  offre_id: string; consulte_le: string; relance_le: string; vue_le: string | null
  dispo: boolean; verifie_le: string | null; offres: OffreRow | OffreRow[] | null
}

// Rappels dus et affichables (offre encore disponible), avec le nombre de non-vus.
export async function getRappels(): Promise<{ items: RappelItem[]; nonVus: number }> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { items: [], nonVus: 0 }
  const { data, error } = await supabase
    .from('rappels')
    .select(`offre_id, consulte_le, relance_le, vue_le, dispo, verifie_le, offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('user_id', user.id)
    .eq('statut', 'en_attente')
  if (error || !data) return { items: [], nonVus: 0 }

  const nowMs = Date.now()
  const items: RappelItem[] = []
  for (const r of data as RappelBrut[]) {
    const offre = (Array.isArray(r.offres) ? r.offres[0] : r.offres) as OffreRow | null
    if (!offre) continue
    const etat = etatRappel(r, nowMs)
    if (!etat.visible) continue

    // Réinitialise vue_le quand le rappel redevient dû (réapparition hebdomadaire).
    if (etat.reinitVue) {
      await supabase.from('rappels').update({ vue_le: null }).eq('user_id', user.id).eq('offre_id', r.offre_id)
    }

    // Vérifie la disponibilité (France Travail) avec un cache de VERIF_TTL_MS.
    let dispo = r.dispo
    const perime = !r.verifie_le || nowMs - Date.parse(r.verifie_le) > VERIF_TTL_MS
    if (offre.source === 'france_travail' && perime) {
      dispo = await ftOffreDisponible(offre.source_id)
      await supabase.from('rappels')
        .update({ dispo, verifie_le: new Date().toISOString() })
        .eq('user_id', user.id).eq('offre_id', r.offre_id)
    }
    if (!dispo) continue

    items.push({ offre, consulte_le: r.consulte_le, nonVu: etat.nonVu })
  }
  items.sort((a, b) => b.consulte_le.localeCompare(a.consulte_le))
  return { items, nonVus: items.filter((i) => i.nonVu).length }
}
