import { expect, test, vi, beforeEach } from 'vitest'

beforeEach(() => { process.env.COLLECT_SECRET = 's3cret' })

const selectSpy = vi.fn(() => ({ eq: () => ({ single: () =>
  Promise.resolve({
    data: { id: 'rech-1', intitule: 'Diététicienne Nantes', mots_cles: [], localisation: '44109', rayon_km: 30, type_contrat: null },
    error: null,
  }) }) }))
vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: () => ({
    from: () => ({ select: selectSpy }),
  }),
}))
vi.mock('@/lib/collector/collect', () => ({
  collectForRecherche: vi.fn().mockResolvedValue({ collected: 5, linked: 5 }),
}))

import { POST } from './route'
import { collectForRecherche } from '@/lib/collector/collect'

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

test('sélectionne intitule en base et le transmet à collectForRecherche', async () => {
  await POST(req({ recherche_id: 'rech-1' }, 'Bearer s3cret'))
  expect(selectSpy).toHaveBeenCalledWith(expect.stringContaining('intitule'))
  expect(collectForRecherche).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ intitule: 'Diététicienne Nantes' }),
  )
})

test('400 sur un corps JSON invalide', async () => {
  const res = await POST(new Request('http://localhost/api/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer s3cret' },
    body: '{not valid json',
  }))
  expect(res.status).toBe(400)
  const json = await res.json()
  expect(json).toMatchObject({ error: 'Corps JSON invalide' })
})
