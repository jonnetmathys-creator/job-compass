import { expect, test, vi } from 'vitest'
import { getCandidature, upsertCandidature } from './lecture'

test('getCandidature filtre sur user_id et offre_id et renvoie la ligne', async () => {
  const single = vi.fn().mockResolvedValue({
    data: { user_id: 'u1', offre_id: 'o1', email_objet: 'Obj', email_corps: 'Corps', lettre: 'L', statut: 'brouillon' },
    error: null,
  })
  const eq2 = vi.fn(() => ({ single }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  const select = vi.fn(() => ({ eq: eq1 }))
  const client = { from: vi.fn(() => ({ select })) } as any

  const cand = await getCandidature(client, 'u1', 'o1')

  expect(client.from).toHaveBeenCalledWith('candidatures')
  expect(eq1).toHaveBeenCalledWith('user_id', 'u1')
  expect(eq2).toHaveBeenCalledWith('offre_id', 'o1')
  expect(cand?.email_objet).toBe('Obj')
})

test('getCandidature renvoie null quand aucune ligne (PGRST116)', async () => {
  const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  const client = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ single }) }) }) })) } as any
  const cand = await getCandidature(client, 'u1', 'o1')
  expect(cand).toBeNull()
})

test('upsertCandidature upsert sur (user_id, offre_id) avec le contenu', async () => {
  const row = { user_id: 'u1', offre_id: 'o1', email_objet: 'O', email_corps: 'C', lettre: 'L', statut: 'brouillon' }
  const single = vi.fn().mockResolvedValue({ data: row, error: null })
  const select = vi.fn(() => ({ single }))
  const upsert = vi.fn((..._args: unknown[]) => ({ select }))
  const client = { from: vi.fn(() => ({ upsert })) } as any

  const out = await upsertCandidature(client, 'u1', 'o1', { email_objet: 'O', email_corps: 'C', lettre: 'L' })

  expect(client.from).toHaveBeenCalledWith('candidatures')
  const [payload, opts] = upsert.mock.calls[0]
  expect(payload).toMatchObject({ user_id: 'u1', offre_id: 'o1', email_objet: 'O', email_corps: 'C', lettre: 'L' })
  expect(opts).toMatchObject({ onConflict: 'user_id,offre_id' })
  expect(out).toMatchObject({ user_id: 'u1', offre_id: 'o1' })
})
