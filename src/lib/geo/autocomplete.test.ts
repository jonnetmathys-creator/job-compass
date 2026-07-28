import { expect, test } from 'vitest'
import { chercherCommunes } from './autocomplete'

const fake = (json: unknown): typeof fetch => (async () => ({ ok: true, json: async () => json })) as unknown as typeof fetch

test('chercherCommunes mappe les features', async () => {
  const r = await chercherCommunes(
    'Nant',
    fake({ features: [{ geometry: { coordinates: [-1.55, 47.21] }, properties: { citycode: '44109', label: 'Nantes' } }] }),
  )
  expect(r).toEqual([{ label: 'Nantes', insee: '44109', lat: 47.21, lng: -1.55 }])
})

test('chercherCommunes : requête trop courte -> []', async () => {
  expect(await chercherCommunes('N', fake({ features: [] }))).toEqual([])
})
