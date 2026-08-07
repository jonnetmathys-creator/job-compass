import { expect, test } from 'vitest'
import { etatRelance, RE_RELANCE_JOURS } from './etat'

const JOUR = 24 * 60 * 60 * 1000
const now = Date.parse('2026-08-07T12:00:00Z')

test('pas de date de relance : invisible', () => {
  expect(etatRelance(null, null, '2026-08-07', now)).toEqual({ visible: false, nonVu: false })
})

test('relance dans le futur : invisible', () => {
  expect(etatRelance('2026-08-10', null, '2026-08-07', now)).toEqual({ visible: false, nonVu: false })
})

test('relance due, jamais vue : visible et non-vue', () => {
  expect(etatRelance('2026-08-07', null, '2026-08-07', now)).toEqual({ visible: true, nonVu: true })
})

test('relance due, vue il y a 2 jours : visible mais grisée', () => {
  const vue = new Date(now - 2 * JOUR).toISOString()
  expect(etatRelance('2026-08-01', vue, '2026-08-07', now)).toEqual({ visible: true, nonVu: false })
})

test('relance due, vue il y a une semaine : redevient non-vue', () => {
  const vue = new Date(now - RE_RELANCE_JOURS * JOUR).toISOString()
  expect(etatRelance('2026-08-01', vue, '2026-08-07', now)).toEqual({ visible: true, nonVu: true })
})
