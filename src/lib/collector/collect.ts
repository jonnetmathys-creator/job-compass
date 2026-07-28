import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSearchParams } from './keywords'
import { searchFranceTravail as ftSearch } from './france-travail'
import { searchAdzuna as azSearch } from './adzuna'
import { dedupeOffres } from './dedupe'
import { storeOffres as store, linkResultats as link } from './store'
import type { NormalizedOffer, RechercheRow } from './types'

type Deps = {
  searchFranceTravail?: (params: any) => Promise<NormalizedOffer[]>
  searchAdzuna?: (params: any) => Promise<NormalizedOffer[]>
  storeOffres?: typeof store
  linkResultats?: typeof link
}

export async function collectForRecherche(
  client: SupabaseClient,
  recherche: RechercheRow & { id: string },
  deps: Deps = {},
): Promise<{ collected: number; linked: number }> {
  const searchFT = deps.searchFranceTravail ?? ftSearch
  const searchAZ = deps.searchAdzuna ?? azSearch
  const storeOffres = deps.storeOffres ?? store
  const linkResultats = deps.linkResultats ?? link

  const params = buildSearchParams(recherche)

  const results = await Promise.allSettled([searchFT(params), searchAZ(params)])
  const lists: NormalizedOffer[][] = []
  for (const r of results) {
    if (r.status === 'fulfilled') lists.push(r.value)
    else console.error('[collect] source en échec :', r.reason)
  }

  const offres = dedupeOffres(...lists)
  const stored = await storeOffres(client, offres)
  await linkResultats(client, recherche.id, stored)
  return { collected: offres.length, linked: stored.length }
}
