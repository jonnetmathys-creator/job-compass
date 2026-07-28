import { expect, test, vi } from 'vitest'
import { getProfil, upsertProfil } from './profil'

function createMockClient(row: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq, single }))
  const upsert = vi.fn(() => ({ select: () => ({ single }) }))
  const from = vi.fn(() => ({ select, upsert, eq }))
  return { from } as any
}

// Happy path: getProfil fetches correctly
test('getProfil calls the right table and filters by user_id', async () => {
  const rowData = { user_id: 'u1', nom: 'Alice', titre_recherche: null, cv_url: null, lettre_base: null }
  const client = createMockClient(rowData)

  const profil = await getProfil(client, 'u1')

  // Verify the right methods were called in the right order
  expect(client.from).toHaveBeenCalledWith('profils')
  expect(client.from().select).toHaveBeenCalledWith('*')
  expect(client.from().select().eq).toHaveBeenCalledWith('user_id', 'u1')
  expect(client.from().select().eq().single).toHaveBeenCalled()
  expect(profil?.nom).toBe('Alice')
})

// Error handling: PGRST116 (no rows) should return null, not throw
test('getProfil returns null when PGRST116 error (no rows)', async () => {
  const pgrst116Error = { code: 'PGRST116', message: 'no rows' }
  const client = createMockClient(null, pgrst116Error)

  const profil = await getProfil(client, 'u1')

  expect(profil).toBeNull()
})

// Error handling: real errors should throw
test('getProfil throws on real errors', async () => {
  const realError = { code: '500', message: 'database error' }
  const client = createMockClient(null, realError)

  await expect(getProfil(client, 'u1')).rejects.toThrow()
})

// Happy path: upsertProfil builds the right payload
test('upsertProfil sends correct payload to upsert', async () => {
  const rowData = { user_id: 'u1', nom: 'Bob', titre_recherche: 'Dev', cv_url: null, lettre_base: null }
  const client = createMockClient(rowData)

  const profil = await upsertProfil(client, 'u1', { nom: 'Bob', titre_recherche: 'Dev' })

  // Verify the upsert call
  expect(client.from).toHaveBeenCalledWith('profils')
  const upsertCall = client.from().upsert
  expect(upsertCall).toHaveBeenCalled()

  // Extract the payload sent to upsert()
  const upsertPayload = upsertCall.mock.calls[0][0]
  expect(upsertPayload).toHaveProperty('user_id', 'u1')
  expect(upsertPayload).toHaveProperty('nom', 'Bob')
  expect(upsertPayload).toHaveProperty('titre_recherche', 'Dev')
  expect(upsertPayload).toHaveProperty('updated_at')
  expect(typeof upsertPayload.updated_at).toBe('string')

  expect(profil.nom).toBe('Bob')
})

// Contract: upsertProfil returns the full Profil object
test('upsertProfil returns the full updated profil row', async () => {
  const rowData = {
    user_id: 'u1',
    nom: 'Carol',
    titre_recherche: 'QA',
    cv_url: 'https://example.com/cv.pdf',
    lettre_base: 'Dear Hiring Manager...'
  }
  const client = createMockClient(rowData)

  const profil = await upsertProfil(client, 'u1', { nom: 'Carol' })

  expect(profil.user_id).toBe('u1')
  expect(profil.nom).toBe('Carol')
  expect(profil.titre_recherche).toBe('QA')
  expect(profil.cv_url).toBe('https://example.com/cv.pdf')
  expect(profil.lettre_base).toBe('Dear Hiring Manager...')
})
