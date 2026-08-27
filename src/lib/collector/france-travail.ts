import { requireEnv } from '@/lib/env'
import { fetchAvecDelai } from '@/lib/http'
import type { NormalizedOffer, SearchParams } from './types'

const TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire'
const SEARCH_URL = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search'
const PAGE_SIZE = 150
const MAX_OFFRES = 300

export function buildFtQuery(params: SearchParams, mot: string): string {
  const qs = new URLSearchParams()
  qs.set('motsCles', mot)
  qs.set('codeROME', params.codeRome)
  if (params.commune) qs.set('commune', params.commune)
  if (params.distance != null) qs.set('distance', String(params.distance))
  if (params.typeContrat) qs.set('typeContrat', params.typeContrat)
  return qs.toString()
}

export function normalizeFtOffre(raw: any): NormalizedOffer {
  return {
    source: 'france_travail',
    source_id: String(raw.id),
    titre: raw.intitule ?? '',
    entreprise: raw.entreprise?.nom ?? null,
    entreprise_logo: raw.entreprise?.logo ?? null,
    description: raw.description ?? null,
    contrat: raw.typeContratLibelle ?? raw.typeContrat ?? null,
    salaire: raw.salaire?.libelle ?? null,
    latitude: raw.lieuTravail?.latitude ?? null,
    longitude: raw.lieuTravail?.longitude ?? null,
    ville: raw.lieuTravail?.libelle ?? null,
    url_postuler: raw.origineOffre?.urlOrigine ?? null,
    email_contact: raw.contact?.courriel ?? null,
    date_publication: raw.dateCreation ?? null,
  }
}

export async function fetchFtToken(fetchImpl: typeof fetch = fetch): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: requireEnv('FT_ID'),
    client_secret: requireEnv('FT_SECRET'),
    scope: 'api_offresdemploiv2 o2dsoffre',
  })
  const res = await fetchAvecDelai(fetchImpl, TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`France Travail token: HTTP ${res.status}`)
  const json = await res.json()
  return json.access_token as string
}

type Deps = { token?: string; fetchImpl?: typeof fetch }

export async function searchFranceTravail(params: SearchParams, deps: Deps = {}): Promise<NormalizedOffer[]> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const token = deps.token ?? (await fetchFtToken(fetchImpl))
  const bySourceId = new Map<string, NormalizedOffer>()

  for (const mot of params.motsCles) {
    if (bySourceId.size >= MAX_OFFRES) break
    const base = buildFtQuery(params, mot)
    let start = 0
    while (start < MAX_OFFRES) {
      const end = Math.min(start + PAGE_SIZE, MAX_OFFRES) - 1
      const res = await fetchAvecDelai(fetchImpl, `${SEARCH_URL}?${base}&range=${start}-${end}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null)
      if (!res) break // délai dépassé ou réseau : on garde ce qui est déjà collecté
      if (res.status === 204) break // aucune offre
      if (!res.ok) break // erreur : on arrête ce mot-clé sans planter
      const json = await res.json()
      const offres = (json.resultats ?? []) as any[]
      for (const raw of offres) {
        const o = normalizeFtOffre(raw)
        bySourceId.set(o.source_id, o) // dédoublonnage intra-source
      }
      if (offres.length < PAGE_SIZE) break // dernière page
      if (bySourceId.size >= MAX_OFFRES) break // plafond global (300) toutes recherches confondues
      start += PAGE_SIZE
    }
  }
  return [...bySourceId.values()].slice(0, MAX_OFFRES)
}
