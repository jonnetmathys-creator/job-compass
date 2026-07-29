import { expect, test } from 'vitest'
import { getFavoriIds } from './lecture'

test('getFavoriIds renvoie la liste des offre_id likées', async () => {
  const client = {
    from: () => ({ select: () => ({ eq: async () => ({ data: [{ offre_id: 'a' }, { offre_id: 'b' }], error: null }) }) }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient
  expect(await getFavoriIds(client, 'user-1')).toEqual(['a', 'b'])
})

test('getFavoriIds relance l’erreur au lieu de la masquer', async () => {
  const client = {
    from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'x' } }) }) }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient
  await expect(getFavoriIds(client, 'user-1')).rejects.toEqual({ message: 'x' })
})
