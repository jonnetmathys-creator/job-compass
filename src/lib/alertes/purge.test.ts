import { expect, test, vi } from 'vitest'
import { offresAPurger, purgerVieillesOffres } from './purge'

const CUTOFF = '2026-07-06T00:00:00Z' // maintenant - 30 j

test('offresAPurger ne garde que les vieilles offres orphelines', () => {
  const offres = [
    { id: 'vieille-orpheline', date_collecte: '2026-06-01T00:00:00Z', created_by: null },
    { id: 'vieille-protegee', date_collecte: '2026-06-01T00:00:00Z', created_by: null },
    { id: 'vieille-manuelle', date_collecte: '2026-06-01T00:00:00Z', created_by: 'u1' },
    { id: 'recente', date_collecte: '2026-08-01T00:00:00Z', created_by: null },
    { id: 'sans-date', date_collecte: null, created_by: null },
  ]
  const ids = offresAPurger({ offres, protegees: new Set(['vieille-protegee']), cutoffISO: CUTOFF })
  expect(ids).toEqual(['vieille-orpheline'])
})

test('purgerVieillesOffres agrège les protégées et supprime les seuls ids attendus', async () => {
  // offres candidates renvoyées par la lecture initiale
  const lt = vi.fn().mockResolvedValue({
    data: [
      { id: 'a', date_collecte: '2026-06-01T00:00:00Z', created_by: null },
      { id: 'b', date_collecte: '2026-06-01T00:00:00Z', created_by: null }, // protégée (favori)
      { id: 'c', date_collecte: '2026-06-01T00:00:00Z', created_by: null }, // protégée (rappel)
    ],
    error: null,
  })
  const protegeeSelect = (rows: any[]) => vi.fn().mockResolvedValue({ data: rows, error: null })
  const deleteIn = vi.fn().mockResolvedValue({ error: null })

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'offres') {
        return {
          select: vi.fn(() => ({ lt })),
          delete: vi.fn(() => ({ in: deleteIn })),
        }
      }
      if (table === 'favoris') return { select: protegeeSelect([{ offre_id: 'b' }]) }
      if (table === 'candidatures') return { select: protegeeSelect([]) }
      if (table === 'rappels') return { select: protegeeSelect([{ offre_id: 'c' }]) }
      throw new Error('table inattendue: ' + table)
    }),
  } as any

  const n = await purgerVieillesOffres(client, 30)

  expect(deleteIn).toHaveBeenCalledWith('id', ['a']) // b et c protégées
  expect(n).toBe(1)
})
