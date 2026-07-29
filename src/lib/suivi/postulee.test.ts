import { expect, test, vi } from 'vitest'
import { setPostulee } from './lecture'

function makeClient() {
  const updates: Record<string, unknown>[] = []
  const upserts: { payload: unknown; opts: unknown }[] = []
  const node = () => {
    const n: any = {}
    n.upsert = (payload: unknown, opts: unknown) => { upserts.push({ payload, opts }); return Promise.resolve({ error: null }) }
    n.update = (p: Record<string, unknown>) => { updates.push(p); return n }
    n.eq = () => n
    n.is = () => Promise.resolve({ error: null })
    n.then = (res: (v: { error: null }) => void) => res({ error: null })
    return n
  }
  const client = { from: vi.fn(() => node()) } as any
  return { client, updates, upserts }
}

test('setPostulee garantit la ligne, promeut le statut, pose les dates si absentes', async () => {
  const { client, updates, upserts } = makeClient()
  await setPostulee(client, 'u1', 'o1', '2026-07-10', '2026-07-20')

  // 1. upsert insert-or-ignore pour garantir l'existence
  expect(upserts[0].opts).toMatchObject({ onConflict: 'user_id,offre_id', ignoreDuplicates: true })
  // 2. promotion brouillon -> postulee
  expect(updates.some((p) => p.statut === 'postulee')).toBe(true)
  // 3. dates posées
  expect(updates.some((p) => p.postulee_le === '2026-07-10')).toBe(true)
  expect(updates.some((p) => p.relance_le === '2026-07-20')).toBe(true)
})
