import { requireEnv } from '@/lib/env'
import { geocodeCommune } from '@/lib/geo/adresse'
import { estPertinenteDietetique } from './pertinence'
import type { NormalizedOffer, SearchParams } from './types'

const MAX_OFFRES = 300
const MAX_PAGES = 15

export function buildJoobleRequest(
  params: SearchParams, mot: string, page: number,
): { url: string; body: Record<string, string> } {
  const url = `https://jooble.org/api/${requireEnv('JOOBLE_API_KEY')}`
  const body: Record<string, string> = { keywords: mot, page: String(page) }
  if (params.commune) body.location = params.commune
  if (params.distance != null) body.radius = String(params.distance)
  return { url, body }
}

// Jooble renvoie des extraits avec des balises (<b>...) : on les retire.
function nettoyerHtml(s: string | null | undefined): string | null {
  if (!s) return null
  const clean = s.replace(/<[^>]*>/g, '').trim()
  return clean || null
}

export function normalizeJoobleOffre(raw: any): NormalizedOffer {
  return {
    source: 'jooble',
    source_id: String(raw.id),
    titre: raw.title ?? '',
    entreprise: raw.company || null,
    entreprise_logo: null, // Jooble ne fournit pas de logo
    description: nettoyerHtml(raw.snippet),
    contrat: raw.type || null,
    salaire: raw.salary || null,
    latitude: null, // rempli à l'étape géocodage
    longitude: null,
    ville: raw.location || null,
    url_postuler: raw.link || null,
    email_contact: null,
    date_publication: raw.updated || null,
  }
}

type Deps = { fetchImpl?: typeof fetch; geocode?: typeof geocodeCommune }

export async function searchJooble(params: SearchParams, deps: Deps = {}): Promise<NormalizedOffer[]> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const geocode = deps.geocode ?? geocodeCommune
  const bySourceId = new Map<string, NormalizedOffer>()

  for (const mot of params.motsCles) {
    for (let page = 1; page <= MAX_PAGES && bySourceId.size < MAX_OFFRES; page++) {
      const { url, body } = buildJoobleRequest(params, mot, page)
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) break // erreur : on arrête ce mot-clé sans planter
      const json = await res.json()
      const jobs = (json.jobs ?? []) as any[]
      if (jobs.length === 0) break // plus de résultats
      for (const raw of jobs) {
        const o = normalizeJoobleOffre(raw)
        if (!estPertinenteDietetique(o)) continue // hors diététique (plein texte sans code métier)
        bySourceId.set(o.source_id, o)
      }
    }
  }

  const offres = [...bySourceId.values()].slice(0, MAX_OFFRES)

  // Jooble ne donne pas de coordonnées : on géocode chaque ville distincte une seule fois.
  const cache = new Map<string, { lat: number; lng: number } | null>()
  for (const o of offres) {
    if (!o.ville) continue
    if (!cache.has(o.ville)) {
      const g = await geocode(o.ville, fetchImpl)
      cache.set(o.ville, g ? { lat: g.lat, lng: g.lng } : null)
    }
    const coords = cache.get(o.ville)
    if (coords) { o.latitude = coords.lat; o.longitude = coords.lng }
  }

  return offres
}
