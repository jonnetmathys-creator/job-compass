import { expect, test, vi } from 'vitest'
import { getSuivi } from './lecture'

test('getSuivi ne renvoie que les candidatures suivies (statut != brouillon), jointes aux offres, triées par date', async () => {
  const rows = [
    { statut: 'postulee', postulee_le: '2026-07-10', relance_le: null, notes: null, offres: { id: 'o1', titre: 'A' } },
    { statut: 'entretien', postulee_le: '2026-07-20', relance_le: '2026-07-25', notes: 'ok', offres: { id: 'o2', titre: 'B' } },
  ]
  const neq = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eq = vi.fn(() => ({ neq }))
  const select = vi.fn(() => ({ eq }))
  const client = { from: vi.fn(() => ({ select })) } as any

  const out = await getSuivi(client, 'u1')

  expect(client.from).toHaveBeenCalledWith('candidatures')
  expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  expect(neq).toHaveBeenCalledWith('statut', 'brouillon')
  // trié par postulee_le décroissant : o2 (07-20) avant o1 (07-10)
  expect(out.map((c) => c.offre.id)).toEqual(['o2', 'o1'])
  expect(out[0]).toMatchObject({ statut: 'entretien', relance_le: '2026-07-25', notes: 'ok' })
})
