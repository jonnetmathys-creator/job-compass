import { expect, test, vi } from 'vitest'
import { setPostulee, clearSuivi, setStatut, setDetailsSuivi } from './lecture'
import { estStatutSuivi } from './statuts'

function makeClient() {
  const calls: any[] = []
  const chain = (result: any = { error: null }) => {
    const c: any = {}
    c.update = vi.fn((patch: any) => { calls.push(patch); return c })
    c.eq = vi.fn(() => c)
    c.is = vi.fn(() => Promise.resolve(result))
    // update().eq().eq() doit résoudre : rendre le dernier eq thenable
    c.then = (res: any) => res(result)
    return c
  }
  const client = { from: vi.fn(() => chain()) } as any
  return { client, calls }
}

test('setPostulee met statut=postulee puis pose postulee_le si null', async () => {
  const { client, calls } = makeClient()
  await setPostulee(client, 'u1', 'o1', '2026-07-29')
  expect(calls.some((p) => p.statut === 'postulee')).toBe(true)
  expect(calls.some((p) => p.postulee_le === '2026-07-29')).toBe(true)
})

test('clearSuivi repasse en brouillon et efface postulee_le', async () => {
  const { client, calls } = makeClient()
  await clearSuivi(client, 'u1', 'o1')
  expect(calls[0]).toMatchObject({ statut: 'brouillon', postulee_le: null })
})

test('setStatut écrit le statut', async () => {
  const { client, calls } = makeClient()
  await setStatut(client, 'u1', 'o1', 'entretien')
  expect(calls[0]).toMatchObject({ statut: 'entretien' })
})

test('setDetailsSuivi écrit notes et relance_le', async () => {
  const { client, calls } = makeClient()
  await setDetailsSuivi(client, 'u1', 'o1', { notes: 'rappel', relance_le: '2026-08-01' })
  expect(calls[0]).toMatchObject({ notes: 'rappel', relance_le: '2026-08-01' })
})

test('estStatutSuivi valide la liste autorisée', () => {
  expect(estStatutSuivi('entretien')).toBe(true)
  expect(estStatutSuivi('brouillon')).toBe(false)
  expect(estStatutSuivi('n_importe_quoi')).toBe(false)
})
