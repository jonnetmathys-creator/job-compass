import { expect, test, vi } from 'vitest'
import { getRelancesDues } from './lecture'

const JOUR = 24 * 60 * 60 * 1000
const now = Date.parse('2026-08-07T12:00:00Z')

// Construit un client mocké : from().select().eq().eq().not().lte() -> {data, error}.
function clientAvec(rows: unknown[], error: unknown = null) {
  const lte = vi.fn().mockResolvedValue({ data: rows, error })
  const not = vi.fn(() => ({ lte }))
  const eq2 = vi.fn(() => ({ not }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  const select = vi.fn(() => ({ eq: eq1 }))
  const from = vi.fn(() => ({ select }))
  return { spies: { from, select, eq1, eq2, not, lte }, client: { from } as any }
}

test('filtre user + statut postulee + relance_le non nulle et due', async () => {
  const { spies, client } = clientAvec([])
  await getRelancesDues(client, 'u1', '2026-08-07', now)
  expect(spies.from).toHaveBeenCalledWith('candidatures')
  expect(spies.eq1).toHaveBeenCalledWith('user_id', 'u1')
  expect(spies.eq2).toHaveBeenCalledWith('statut', 'postulee')
  expect(spies.not).toHaveBeenCalledWith('relance_le', 'is', null)
  expect(spies.lte).toHaveBeenCalledWith('relance_le', '2026-08-07')
})

test('joint les offres, trie par relance_le et compte les non-vus', async () => {
  const vueRecente = new Date(now - JOUR).toISOString()
  const rows = [
    { postulee_le: '2026-07-30', relance_le: '2026-08-05', relance_vue_le: null, offres: { id: 'b', titre: 'B' } },
    { postulee_le: '2026-07-25', relance_le: '2026-08-01', relance_vue_le: vueRecente, offres: { id: 'a', titre: 'A' } },
  ]
  const { client } = clientAvec(rows)
  const { items, nonVus } = await getRelancesDues(client, 'u1', '2026-08-07', now)
  expect(items.map((i) => i.offre.id)).toEqual(['a', 'b']) // relance_le la plus ancienne d'abord
  expect(items[0].nonVu).toBe(false) // 'a' vue hier -> grisée
  expect(items[1].nonVu).toBe(true) // 'b' jamais vue -> rouge
  expect(nonVus).toBe(1)
})

test('ignore les lignes sans offre jointe', async () => {
  const rows = [{ postulee_le: null, relance_le: '2026-08-01', relance_vue_le: null, offres: null }]
  const { client } = clientAvec(rows)
  const { items } = await getRelancesDues(client, 'u1', '2026-08-07', now)
  expect(items).toEqual([])
})

test('erreur de requête : renvoie une liste vide sans lever', async () => {
  const { client } = clientAvec(null as unknown as unknown[], { message: 'boom' })
  const out = await getRelancesDues(client, 'u1', '2026-08-07', now)
  expect(out).toEqual({ items: [], nonVus: 0 })
})
