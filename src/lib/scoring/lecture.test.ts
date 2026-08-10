import { expect, test, vi } from 'vitest'
import { getScores } from './lecture'

// Construit un client dont chaque appel .in(col, lot) résout avec les scores
// correspondant aux ids du lot, et compte le nombre d'appels.
function clientAvec(scoresParId: Record<string, { score: number; raison: string | null }>) {
  const inSpy = vi.fn((_col: string, lot: string[]) => Promise.resolve({
    data: lot.filter((id) => scoresParId[id]).map((id) => ({ offre_id: id, ...scoresParId[id] })),
    error: null,
  }))
  const eq = vi.fn(() => ({ in: inSpy }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { client: { from } as any, inSpy }
}

test('liste vide -> map vide, aucune requête', async () => {
  const { client, inSpy } = clientAvec({})
  const map = await getScores(client, 'u1', [])
  expect(map.size).toBe(0)
  expect(inSpy).not.toHaveBeenCalled()
})

test('borne le score entre 0 et 100', async () => {
  const { client } = clientAvec({ a: { score: 150, raison: 'fort' }, b: { score: -5, raison: null } })
  const map = await getScores(client, 'u1', ['a', 'b'])
  expect(map.get('a')).toEqual({ score: 100, raison: 'fort' })
  expect(map.get('b')).toEqual({ score: 0, raison: null })
})

test('découpe en lots de 100 pour éviter une URL trop longue', async () => {
  const ids = Array.from({ length: 250 }, (_, i) => `o${i}`)
  const scores = Object.fromEntries(ids.map((id, i) => [id, { score: i % 101, raison: null }]))
  const { client, inSpy } = clientAvec(scores)
  const map = await getScores(client, 'u1', ids)
  expect(inSpy).toHaveBeenCalledTimes(3) // 100 + 100 + 50
  expect(map.size).toBe(250)
  expect(inSpy.mock.calls[0][1]).toHaveLength(100)
  expect(inSpy.mock.calls[2][1]).toHaveLength(50)
})
