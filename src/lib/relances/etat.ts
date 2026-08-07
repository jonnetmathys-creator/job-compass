// Cadence d'affichage d'une relance de suivi dans la cloche.
export const RE_RELANCE_JOURS = 7 // réapparition hebdomadaire tant que non relancée
const JOUR_MS = 24 * 60 * 60 * 1000

export type RelanceEtat = { visible: boolean; nonVu: boolean }

// État d'une relance à faire pour une candidature « postulee ».
// - relance_le absente ou dans le futur : pas encore due (invisible).
// - jamais vue/notifiée (relance_vue_le null) : due et non-vue (rouge).
// - vue il y a moins d'une semaine : due mais grisée (déjà signalée).
// - vue il y a une semaine ou plus : redevient non-vue (rouge).
// Le statut « postulee » est filtré en amont par la requête (voir lecture.ts).
export function etatRelance(
  relanceLe: string | null,
  relanceVueLe: string | null,
  todayIso: string,
  nowMs: number,
): RelanceEtat {
  if (!relanceLe || relanceLe > todayIso) return { visible: false, nonVu: false }
  if (!relanceVueLe) return { visible: true, nonVu: true }
  const reDu = nowMs - Date.parse(relanceVueLe) >= RE_RELANCE_JOURS * JOUR_MS
  return { visible: true, nonVu: reDu }
}
