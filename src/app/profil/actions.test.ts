import { expect, test, vi, beforeEach } from 'vitest'

const getUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ getServerClient: async () => ({ auth: { getUser } }) }))

const deleteEq = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: () => ({ from: () => ({ delete: () => ({ eq: deleteEq }) }) }),
}))

const getProfil = vi.fn()
const upsertProfil = vi.fn().mockResolvedValue({})
vi.mock('@/lib/profil', () => ({
  getProfil: (...a: unknown[]) => getProfil(...a),
  upsertProfil: (...a: unknown[]) => upsertProfil(...a),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { enregistrerProfil } from './actions'

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  deleteEq.mockClear(); upsertProfil.mockClear()
})

test('purge le cache de scores quand les préférences changent', async () => {
  getProfil.mockResolvedValue({ preferences: ['cdi'] })
  const res = await enregistrerProfil({ nom: 'A', titre_recherche: null, preferences: ['cdi', 'liberal'] })
  expect(res.ok).toBe(true)
  expect(deleteEq).toHaveBeenCalledWith('user_id', 'u1')
})

test('ne purge pas si les préférences sont identiques (ordre différent)', async () => {
  getProfil.mockResolvedValue({ preferences: ['cdi', 'liberal'] })
  const res = await enregistrerProfil({ nom: 'A', titre_recherche: null, preferences: ['liberal', 'cdi'] })
  expect(res.ok).toBe(true)
  expect(deleteEq).not.toHaveBeenCalled()
})

test('ignore les clés inconnues avant comparaison', async () => {
  getProfil.mockResolvedValue({ preferences: ['cdi'] })
  const res = await enregistrerProfil({ nom: 'A', titre_recherche: null, preferences: ['cdi', 'bidon'] })
  expect(res.ok).toBe(true)
  expect(deleteEq).not.toHaveBeenCalled() // 'bidon' filtré -> reste ['cdi'] -> inchangé
})

test('refuse sans utilisateur connecté', async () => {
  getUser.mockResolvedValue({ data: { user: null } })
  const res = await enregistrerProfil({ nom: null, titre_recherche: null, preferences: [] })
  expect(res.ok).toBe(false)
})
