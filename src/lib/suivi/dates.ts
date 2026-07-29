// Fonctions de dates pures (UTC, format yyyy-mm-dd) pour éviter les décalages de fuseau.

export function ajouterJours(dateIso: string, n: number): string {
  const d = new Date(dateIso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function joursDepuis(dateIso: string, todayIso: string): number {
  const a = new Date(dateIso + 'T00:00:00Z').getTime()
  const b = new Date(todayIso + 'T00:00:00Z').getTime()
  return Math.floor((b - a) / 86400000)
}

// Une candidature est « à relancer » si elle est encore en attente (postulee),
// a une date de relance posée, et cette date est atteinte ou dépassée.
export function estARelancer(statut: string, relanceLe: string | null, todayIso: string): boolean {
  return statut === 'postulee' && !!relanceLe && relanceLe <= todayIso
}
