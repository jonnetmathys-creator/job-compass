// Constantes de cadence des rappels.
export const PREMIER_RAPPEL_JOURS = 2 // délai avant le premier rappel
export const RE_RAPPEL_JOURS = 7 // réapparition hebdomadaire une fois consulté
export const VERIF_TTL_MS = 6 * 60 * 60 * 1000 // fraîcheur d'une vérif de disponibilité

const JOUR_MS = 24 * 60 * 60 * 1000

// Décale une date ISO de n jours (renvoie une nouvelle date ISO).
export function ajouterJours(iso: string, n: number): string {
  return new Date(new Date(iso).getTime() + n * JOUR_MS).toISOString()
}

// « il y a X » adapté à l'échelle : minutes, heures, jours, semaines, mois.
export function formatEcoule(ms: number): string {
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${Math.max(1, min)} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} heure${h > 1 ? 's' : ''}`
  const j = Math.floor(h / 24)
  if (j < 7) return `${j} jour${j > 1 ? 's' : ''}`
  const sem = Math.floor(j / 7)
  if (sem < 5) return `${sem} semaine${sem > 1 ? 's' : ''}`
  const mois = Math.max(1, Math.floor(j / 30))
  return `${mois} mois`
}

export type RappelEtat = { visible: boolean; nonVu: boolean; reinitVue: boolean }

// État d'affichage d'un rappel à l'instant nowMs, à partir de ses horodatages.
// - avant relance_le : invisible (pas encore dû)
// - jamais vu : visible et non-vu (rouge)
// - vu il y a moins d'une semaine : visible et vu (grisé)
// - vu il y a une semaine ou plus : redevient non-vu (rouge), on réinitialise vue_le
export function etatRappel(
  row: { relance_le: string; vue_le: string | null },
  nowMs: number,
): RappelEtat {
  if (nowMs < Date.parse(row.relance_le)) return { visible: false, nonVu: false, reinitVue: false }
  if (!row.vue_le) return { visible: true, nonVu: true, reinitVue: false }
  const reDu = nowMs >= Date.parse(row.vue_le) + RE_RAPPEL_JOURS * JOUR_MS
  return { visible: true, nonVu: reDu, reinitVue: reDu }
}
