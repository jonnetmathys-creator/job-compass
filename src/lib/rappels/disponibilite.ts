import { fetchFtToken } from '@/lib/collector/france-travail'

const OFFRE_URL = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres'

type Deps = { token?: string; fetchImpl?: typeof fetch }

// Vérifie qu'une offre France Travail est toujours en ligne (inutile de relancer sinon).
// 200/206 = disponible ; 204/404/410 = retirée. Toute autre réponse (erreur réseau,
// quota) laisse le bénéfice du doute : on ne masque pas le rappel.
export async function ftOffreDisponible(sourceId: string, deps: Deps = {}): Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? fetch
  try {
    const token = deps.token ?? (await fetchFtToken(fetchImpl))
    const res = await fetchImpl(`${OFFRE_URL}/${encodeURIComponent(sourceId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 204 || res.status === 404 || res.status === 410) return false
    return true
  } catch {
    return true
  }
}
