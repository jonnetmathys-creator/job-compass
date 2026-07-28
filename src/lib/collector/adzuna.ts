import { requireEnv } from '@/lib/env'
import type { NormalizedOffer, SearchParams } from './types'

const RESULTS_PER_PAGE = 50
const MAX_OFFRES = 300

export function buildAdzunaUrl(params: SearchParams, mot: string, page: number): string {
  const qs = new URLSearchParams()
  qs.set('app_id', requireEnv('ADZUNA_APP_ID'))
  qs.set('app_key', requireEnv('ADZUNA_APP_KEY'))
  qs.set('what', mot)
  qs.set('results_per_page', String(RESULTS_PER_PAGE))
  if (params.commune) qs.set('where', params.commune)
  if (params.distance != null) qs.set('distance', String(params.distance))
  return `https://api.adzuna.com/v1/api/jobs/fr/search/${page}?${qs.toString()}`
}

export function normalizeAdzunaOffre(raw: any): NormalizedOffer {
  const min = raw.salary_min, max = raw.salary_max
  const salaire = min && max ? `${min} - ${max}` : min ? String(min) : null
  return {
    source: 'adzuna',
    source_id: String(raw.id),
    titre: raw.title ?? '',
    entreprise: raw.company?.display_name ?? null,
    description: raw.description ?? null,
    contrat: raw.contract_time ?? raw.contract_type ?? null,
    salaire,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    ville: raw.location?.display_name ?? null,
    url_postuler: raw.redirect_url ?? null,
    email_contact: null,
    date_publication: raw.created ?? null,
  }
}

type Deps = { fetchImpl?: typeof fetch }

export async function searchAdzuna(params: SearchParams, deps: Deps = {}): Promise<NormalizedOffer[]> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const bySourceId = new Map<string, NormalizedOffer>()

  for (const mot of params.motsCles) {
    let page = 1
    while (bySourceId.size < MAX_OFFRES) {
      const res = await fetchImpl(buildAdzunaUrl(params, mot, page))
      if (!res.ok) break // erreur : on arrête ce mot-clé sans planter
      const json = await res.json()
      const offres = (json.results ?? []) as any[]
      for (const raw of offres) {
        const o = normalizeAdzunaOffre(raw)
        bySourceId.set(o.source_id, o)
      }
      if (offres.length < RESULTS_PER_PAGE) break // dernière page
      page += 1
    }
  }
  return [...bySourceId.values()]
}
