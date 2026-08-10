import { expect, test, vi } from 'vitest'
import { getBoite, compterNonVues, marquerOffreVue, marquerToutesVues } from './boite'

test('getBoite ne renvoie que le non-vu sur la fenêtre, joint aux offres, trié', async () => {
  const rows = [
    { created_at: '2026-07-29T10:00:00Z', vue_le: null, offres: { id: 'o2', titre: 'B' } },
    { created_at: '2026-07-29T08:00:00Z', vue_le: null, offres: { id: 'o1', titre: 'A' } },
  ]
  const gt = vi.fn().mockResolvedValue({ data: rows, error: null })
  const is = vi.fn(() => ({ gt }))
  const eq = vi.fn(() => ({ is }))
  const select = vi.fn(() => ({ eq }))
  const client = { from: vi.fn(() => ({ select })) } as any

  const out = await getBoite(client, 'u1', { getScores: async () => new Map() })

  expect(client.from).toHaveBeenCalledWith('nouvelles_offres')
  expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  expect(is).toHaveBeenCalledWith('vue_le', null)
  // filtre de fenêtre appliqué sur created_at
  expect(gt).toHaveBeenCalledWith('created_at', expect.any(String))
  expect(out.map((n) => n.offre.id)).toEqual(['o2', 'o1'])
})

test('getBoite remonte les top match (≥90) en tête', async () => {
  const rows = [
    { created_at: '2026-07-29T10:00:00Z', vue_le: null, offres: { id: 'recent', titre: 'Récent' } },
    { created_at: '2026-07-29T08:00:00Z', vue_le: null, offres: { id: 'top', titre: 'Top' } },
  ]
  const gt = vi.fn().mockResolvedValue({ data: rows, error: null })
  const client = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ is: () => ({ gt }) }) }) })) } as any
  const getScores = async () => new Map([['top', { score: 95, raison: 'fort' }]])
  const out = await getBoite(client, 'u1', { getScores })
  expect(out[0].offre.id).toBe('top')      // top match d'abord, malgré une date plus ancienne
  expect(out[0].score).toBe(95)
})

test('compterNonVues filtre vue_le null et la fenêtre', async () => {
  const gt = vi.fn().mockResolvedValue({ data: [{ offre_id: 'a' }, { offre_id: 'b' }], error: null })
  const is = vi.fn(() => ({ gt }))
  const eq = vi.fn(() => ({ is }))
  const select = vi.fn(() => ({ eq }))
  const client = { from: vi.fn(() => ({ select })) } as any

  const n = await compterNonVues(client, 'u1')
  expect(is).toHaveBeenCalledWith('vue_le', null)
  expect(n).toBe(2)
})

test('marquerToutesVues pose vue_le sur toutes les entrées non vues', async () => {
  const is = vi.fn(() => Promise.resolve({ error: null }))
  const eq = vi.fn(() => ({ is }))
  const calls: any[] = []
  const update = vi.fn((p: any) => { calls.push(p); return { eq } })
  const client = { from: vi.fn(() => ({ update })) } as any

  await marquerToutesVues(client, 'u1')
  expect(client.from).toHaveBeenCalledWith('nouvelles_offres')
  expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  expect(is).toHaveBeenCalledWith('vue_le', null)
  expect(calls[0]).toHaveProperty('vue_le')
})

test('marquerOffreVue pose vue_le pour l\'entrée non vue', async () => {
  const calls: any[] = []
  const is = vi.fn(() => Promise.resolve({ error: null }))
  const eq2 = vi.fn(() => ({ is }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  const update = vi.fn((p: any) => { calls.push(p); return { eq: eq1 } })
  const client = { from: vi.fn(() => ({ update })) } as any

  await marquerOffreVue(client, 'u1', 'o1')
  expect(client.from).toHaveBeenCalledWith('nouvelles_offres')
  expect(calls[0]).toHaveProperty('vue_le')
})
