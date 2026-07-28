import { expect, test, vi } from 'vitest'
import { getProfil, upsertProfil } from './profil'

function mockClient(row: unknown) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq, single }))
  const upsert = vi.fn(() => ({ select: () => ({ single }) }))
  return { from: vi.fn(() => ({ select, upsert, eq })) } as any
}

test('getProfil renvoie la ligne', async () => {
  const client = mockClient({ user_id: 'u1', nom: 'Alice' })
  const profil = await getProfil(client, 'u1')
  expect(profil?.nom).toBe('Alice')
})

test('upsertProfil renvoie la ligne mise à jour', async () => {
  const client = mockClient({ user_id: 'u1', nom: 'Bob' })
  const profil = await upsertProfil(client, 'u1', { nom: 'Bob' })
  expect(profil.nom).toBe('Bob')
})
