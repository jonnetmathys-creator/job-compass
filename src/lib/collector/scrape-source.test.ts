import { expect, test, vi } from 'vitest'
import { offresScrapeesPour } from './scrape-source'

function clientAvec(rows: any[]) {
  const gt = vi.fn().mockResolvedValue({ data: rows, error: null })
  const inFn = vi.fn(() => ({ gt }))
  const select = vi.fn(() => ({ in: inFn }))
  return { from: vi.fn(() => ({ select })) } as any
}

const NANTES = { insee: '44109', lat: 47.218, lng: -1.554, label: 'Nantes' }

test('sans localisation, renvoie toutes les offres scrapées récentes', async () => {
  const rows = [
    { id: 'a', source: 'afdn', source_id: '1', latitude: 47.2, longitude: -1.5 },
    { id: 'b', source: 'afdn', source_id: '2', latitude: 48.8, longitude: 2.3 },
  ]
  const out = await offresScrapeesPour(clientAvec(rows), { localisation: null, rayon_km: null }, { geocode: vi.fn() as any })
  expect(out.map((o) => o.id)).toEqual(['a', 'b'])
})

test('avec localisation, filtre par rayon et garde les offres sans coords', async () => {
  const rows = [
    { id: 'proche', source: 'afdn', source_id: '1', latitude: 47.25, longitude: -1.5 }, // ~5 km de Nantes
    { id: 'loin', source: 'afdn', source_id: '2', latitude: 48.85, longitude: 2.35 },   // Paris
    { id: 'sanscoords', source: 'afdn', source_id: '3', latitude: null, longitude: null },
  ]
  const geocode = vi.fn().mockResolvedValue(NANTES)
  const out = await offresScrapeesPour(clientAvec(rows), { localisation: 'Nantes', rayon_km: 30 }, { geocode: geocode as any })
  expect(out.map((o) => o.id).sort()).toEqual(['proche', 'sanscoords'])
})

test('si le géocodage échoue, renvoie tout (pas de filtre)', async () => {
  const rows = [{ id: 'a', source: 'afdn', source_id: '1', latitude: 48.8, longitude: 2.3 }]
  const geocode = vi.fn().mockResolvedValue(null)
  const out = await offresScrapeesPour(clientAvec(rows), { localisation: 'zzz', rayon_km: 10 }, { geocode: geocode as any })
  expect(out.map((o) => o.id)).toEqual(['a'])
})
