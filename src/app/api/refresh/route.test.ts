import { afterEach, beforeEach, expect, test } from 'vitest'
import { autorise } from './route'

const requete = (bearer?: string) =>
  new Request('http://localhost/api/refresh', {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
  })

const original = { collect: process.env.COLLECT_SECRET, cron: process.env.CRON_SECRET }

beforeEach(() => {
  delete process.env.COLLECT_SECRET
  delete process.env.CRON_SECRET
})

afterEach(() => {
  if (original.collect === undefined) delete process.env.COLLECT_SECRET
  else process.env.COLLECT_SECRET = original.collect
  if (original.cron === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = original.cron
})

test('accepte un bearer correspondant à COLLECT_SECRET', () => {
  process.env.COLLECT_SECRET = 'secret-manuel'
  expect(autorise(requete('secret-manuel'))).toBe(true)
})

test('accepte un bearer correspondant à CRON_SECRET (cron Vercel)', () => {
  process.env.CRON_SECRET = 'secret-cron'
  expect(autorise(requete('secret-cron'))).toBe(true)
})

test('refuse sans throw si aucun secret n\'est configuré', () => {
  expect(() => autorise(requete('nimporte-quoi'))).not.toThrow()
  expect(autorise(requete('nimporte-quoi'))).toBe(false)
})

test('refuse un bearer qui ne correspond à aucun secret configuré', () => {
  process.env.COLLECT_SECRET = 'secret-manuel'
  process.env.CRON_SECRET = 'secret-cron'
  expect(autorise(requete('mauvais-secret'))).toBe(false)
})
