import { expect, test, vi } from 'vitest'
import { rafraichirRecherche, enregistrerNouvelles } from './detection'

function clientLies(avant: string[], apres: string[]) {
  let appel = 0
  const eq = vi.fn(() => {
    appel += 1
    const ids = appel === 1 ? avant : apres
    return Promise.resolve({ data: ids.map((offre_id) => ({ offre_id })), error: null })
  })
  const select = vi.fn(() => ({ eq }))
  const update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const client = { from: vi.fn(() => ({ select, update })) } as any
  return client
}

test('rafraichirRecherche renvoie les offre_id apparus entre avant et après', async () => {
  const client = clientLies(['a', 'b'], ['a', 'b', 'c', 'd'])
  const collect = vi.fn().mockResolvedValue({ collected: 4, linked: 4 })
  const recherche = { id: 'r1', mots_cles: ['x'], localisation: null, rayon_km: null, type_contrat: null }

  const { nouvelles } = await rafraichirRecherche(client, recherche as any, { collect })

  expect(collect).toHaveBeenCalledTimes(1)
  expect(nouvelles.sort()).toEqual(['c', 'd'])
})

test('enregistrerNouvelles upsert ignoreDuplicates et renvoie le nombre inséré', async () => {
  const select = vi.fn().mockResolvedValue({ data: [{ offre_id: 'c' }], error: null })
  const upsert = vi.fn((..._args: unknown[]) => ({ select }))
  const client = { from: vi.fn(() => ({ upsert })) } as any

  const n = await enregistrerNouvelles(client, 'u1', 'r1', ['c', 'd'])

  expect(client.from).toHaveBeenCalledWith('nouvelles_offres')
  const [rows, opts] = upsert.mock.calls[0]
  expect(rows).toEqual([
    expect.objectContaining({ user_id: 'u1', offre_id: 'c', recherche_id: 'r1' }),
    expect.objectContaining({ user_id: 'u1', offre_id: 'd', recherche_id: 'r1' }),
  ])
  expect(opts).toMatchObject({ onConflict: 'user_id,offre_id', ignoreDuplicates: true })
  expect(n).toBe(1)
})

test('enregistrerNouvelles ne fait rien si la liste est vide', async () => {
  const client = { from: vi.fn() } as any
  const n = await enregistrerNouvelles(client, 'u1', 'r1', [])
  expect(n).toBe(0)
  expect(client.from).not.toHaveBeenCalled()
})
