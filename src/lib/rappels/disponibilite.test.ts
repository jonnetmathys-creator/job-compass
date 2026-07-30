import { expect, test, vi } from 'vitest'
import { ftOffreDisponible } from './disponibilite'

function fetchStatut(status: number) {
  return vi.fn((..._args: unknown[]) => Promise.resolve({ status } as Response))
}

test('200 -> offre disponible', async () => {
  const f = fetchStatut(200)
  expect(await ftOffreDisponible('123', { token: 't', fetchImpl: f })).toBe(true)
})

test('204/404/410 -> offre retirée', async () => {
  expect(await ftOffreDisponible('1', { token: 't', fetchImpl: fetchStatut(204) })).toBe(false)
  expect(await ftOffreDisponible('2', { token: 't', fetchImpl: fetchStatut(404) })).toBe(false)
  expect(await ftOffreDisponible('3', { token: 't', fetchImpl: fetchStatut(410) })).toBe(false)
})

test('erreur serveur -> bénéfice du doute (disponible)', async () => {
  expect(await ftOffreDisponible('4', { token: 't', fetchImpl: fetchStatut(500) })).toBe(true)
})

test('exception réseau -> bénéfice du doute (disponible)', async () => {
  const f = vi.fn((..._args: unknown[]) => Promise.reject(new Error('réseau')))
  expect(await ftOffreDisponible('5', { token: 't', fetchImpl: f })).toBe(true)
})

test('appelle l endpoint offre par identifiant avec le token', async () => {
  const f = fetchStatut(200)
  await ftOffreDisponible('abc 1', { token: 'tok', fetchImpl: f })
  const [url, opts] = f.mock.calls[0] as [string, RequestInit]
  expect(url).toContain('/v2/offres/abc%201')
  expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok')
})
