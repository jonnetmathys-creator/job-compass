import { expect, test, vi, beforeEach } from 'vitest'

beforeEach(() => { process.env.COLLECT_SECRET = 's3cret' })

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: () =>
      Promise.resolve({ data: { id: 'rech-1', mots_cles: [], localisation: '44109', rayon_km: 30, type_contrat: null }, error: null }) }) }) }),
  }),
}))
vi.mock('@/lib/collector/collect', () => ({
  collectForRecherche: vi.fn().mockResolvedValue({ collected: 5, linked: 5 }),
}))

import { POST } from './route'

function req(body: unknown, auth?: string) {
  return new Request('http://localhost/api/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  })
}

test('401 sans secret valide', async () => {
  const res = await POST(req({ recherche_id: 'rech-1' }))
  expect(res.status).toBe(401)
})

test('200 et récap avec le bon secret', async () => {
  const res = await POST(req({ recherche_id: 'rech-1' }, 'Bearer s3cret'))
  expect(res.status).toBe(200)
  const json = await res.json()
  expect(json).toMatchObject({ collected: 5, linked: 5 })
})
