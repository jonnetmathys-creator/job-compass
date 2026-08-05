import type { SupabaseClient } from '@supabase/supabase-js'
import { geocodeCommune } from '@/lib/geo/adresse'
import { distanceKm } from './geo-distance'
import type { StoredOffre } from './store'

const SOURCES_SCRAPEES = ['afdn']
const FRAICHEUR_JOURS = 14

type RechercheGeo = { localisation: string | null; rayon_km: number | null }
type Deps = { geocode?: typeof geocodeCommune }
type Ligne = { id: string; source: string; source_id: string; latitude: number | null; longitude: number | null }

export async function offresScrapeesPour(
  client: SupabaseClient, recherche: RechercheGeo, deps: Deps = {},
): Promise<StoredOffre[]> {
  const geocode = deps.geocode ?? geocodeCommune
  const cutoff = new Date(Date.now() - FRAICHEUR_JOURS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await client
    .from('offres')
    .select('id, source, source_id, latitude, longitude')
    .in('source', SOURCES_SCRAPEES)
    .gt('date_collecte', cutoff)
  if (error) throw error
  const lignes = (data ?? []) as Ligne[]

  const stored = (l: Ligne): StoredOffre => ({ id: l.id, source: l.source, source_id: l.source_id })

  // Pas de filtre géo si la recherche n'a ni lieu ni rayon.
  if (!recherche.localisation || recherche.rayon_km == null) return lignes.map(stored)

  const centre = await geocode(recherche.localisation)
  if (!centre) return lignes.map(stored) // géocodage KO : on ne filtre pas

  return lignes
    .filter((l) =>
      l.latitude == null || l.longitude == null || // offre sans coords : conservée
      distanceKm({ lat: centre.lat, lng: centre.lng }, { lat: l.latitude, lng: l.longitude }) <= recherche.rayon_km!)
    .map(stored)
}
