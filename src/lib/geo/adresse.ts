import { fetchAvecDelai } from '@/lib/http'

const BASE = 'https://api-adresse.data.gouv.fr/search/'

export async function geocodeCommune(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ insee: string; lat: number; lng: number; label: string } | null> {
  const url = `${BASE}?q=${encodeURIComponent(query)}&type=municipality&limit=1`
  // Borné : Jooble géocode chaque ville en série ; un appel qui pend gèlerait la collecte.
  const res = await fetchAvecDelai(fetchImpl, url).catch(() => null)
  if (!res || !res.ok) return null
  const json = (await res.json()) as {
    features?: { geometry: { coordinates: [number, number] }; properties: { citycode: string; label: string } }[]
  }
  const f = json.features?.[0]
  if (!f) return null
  return { insee: f.properties.citycode, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], label: f.properties.label }
}
