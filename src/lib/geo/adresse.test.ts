import { expect, test } from 'vitest'
import { geocodeCommune } from './adresse'

function fakeFetch(json: unknown): typeof fetch {
  return (async () => ({ ok: true, json: async () => json })) as unknown as typeof fetch
}

test('extrait code INSEE et coordonnées de la 1re proposition', async () => {
  const res = await geocodeCommune('Nantes', fakeFetch({
    features: [{ geometry: { coordinates: [-1.5536, 47.2184] }, properties: { citycode: '44109', label: 'Nantes' } }],
  }))
  expect(res).toEqual({ insee: '44109', lat: 47.2184, lng: -1.5536, label: 'Nantes' })
})

test('renvoie null quand aucune proposition', async () => {
  const res = await geocodeCommune('zzz', fakeFetch({ features: [] }))
  expect(res).toBeNull()
})
