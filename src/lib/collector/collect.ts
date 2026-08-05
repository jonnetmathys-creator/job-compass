import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSearchParams } from './keywords'
import { searchFranceTravail as ftSearch } from './france-travail'
import { searchAdzuna as azSearch } from './adzuna'
import { searchJooble as jbSearch } from './jooble'
import { dedupeOffres } from './dedupe'
import { storeOffres as store, linkResultats as link, type StoredOffre } from './store'
import { offresScrapeesPour } from './scrape-source'
import type { NormalizedOffer, RechercheRow } from './types'

type Deps = {
  searchFranceTravail?: (params: any) => Promise<NormalizedOffer[]>
  searchAdzuna?: (params: any) => Promise<NormalizedOffer[]>
  searchJooble?: (params: any) => Promise<NormalizedOffer[]>
  offresScrapees?: (client: SupabaseClient, recherche: any) => Promise<StoredOffre[]>
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
  const searchJB = deps.searchJooble ?? jbSearch
  const offresScrapees = deps.offresScrapees ?? offresScrapeesPour
  const storeOffres = deps.storeOffres ?? store
  const linkResultats = deps.linkResultats ?? link

  const params = buildSearchParams(recherche)

  const results = await Promise.allSettled([searchFT(params), searchAZ(params), searchJB(params)])
  const lists: NormalizedOffer[][] = []
  for (const r of results) {
    if (r.status === 'fulfilled') lists.push(r.value)
    else console.error('[collect] source en échec :', r.reason)
  }

  const offres = dedupeOffres(...lists)
  const stored = await storeOffres(client, offres)

  // Source scrapée isolée : un échec ne remet pas en cause les offres API déjà stockées.
  let scrapees: StoredOffre[] = []
  try { scrapees = await offresScrapees(client, recherche) }
  catch (e) { console.error('[collect] offres scrapées en échec :', e) }
  await linkResultats(client, recherche.id, [...stored, ...scrapees])

  return { collected: offres.length, linked: stored.length + scrapees.length }
}
