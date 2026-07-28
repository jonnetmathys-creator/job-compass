import { createClient } from '@supabase/supabase-js'
import { beforeAll, expect, test } from 'vitest'

const url = process.env.TEST_SUPABASE_URL!
const anon = process.env.TEST_SUPABASE_ANON_KEY!
const service = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, service, { auth: { persistSession: false } })

async function makeUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: 'motdepasse123', email_confirm: true,
  })
  if (error) throw error
  const client = createClient(url, anon, { auth: { persistSession: false } })
  await client.auth.signInWithPassword({ email, password: 'motdepasse123' })
  return { id: data.user!.id, client }
}

let alice: Awaited<ReturnType<typeof makeUser>>
let bob: Awaited<ReturnType<typeof makeUser>>

beforeAll(async () => {
  alice = await makeUser(`alice-${Date.now()}@test.local`)
  bob = await makeUser(`bob-${Date.now()}@test.local`)
  await alice.client.from('profils').insert({ user_id: alice.id, nom: 'Alice' })
})

test('un utilisateur lit son propre profil', async () => {
  const { data } = await alice.client.from('profils').select('*').eq('user_id', alice.id)
  expect(data?.[0]?.nom).toBe('Alice')
})

test('un utilisateur ne lit pas le profil d’un autre', async () => {
  const { data } = await bob.client.from('profils').select('*').eq('user_id', alice.id)
  expect(data).toEqual([]) // RLS masque la ligne d'Alice
})
