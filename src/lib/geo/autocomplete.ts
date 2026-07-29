export const METIERS_DIETETIQUE = [
  'Diététicien',
  'Diététicienne',
  'Diététicien nutritionniste',
  'Nutritionniste',
  'Conseiller en nutrition',
  'Diététicien hospitalier',
  'Diététicien en restauration collective',
  'Nutrithérapeute',
  'Diététicien libéral',
]

const BASE = 'https://api-adresse.data.gouv.fr/search/'

export async function chercherCommunes(
  q: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ label: string; insee: string; lat: number; lng: number }[]> {
  if (q.trim().length < 2) return []
  const res = await fetchImpl(`${BASE}?q=${encodeURIComponent(q)}&type=municipality&limit=6`)
  if (!res.ok) return []
  const json = (await res.json()) as {
    features?: { geometry: { coordinates: [number, number] }; properties: { citycode: string; label: string } }[]
  }
  return (json.features ?? []).map((f) => ({
    label: f.properties.label,
    insee: f.properties.citycode,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }))
}
