import { expect, test } from 'vitest'
import { ajouterJours, formatEcoule, etatRappel } from './dates'

test('ajouterJours décale de n jours', () => {
  expect(ajouterJours('2026-01-01T00:00:00.000Z', 2)).toBe('2026-01-03T00:00:00.000Z')
})

test('formatEcoule choisit la bonne échelle', () => {
  expect(formatEcoule(20 * 1000)).toBe('1 min')      // < 1 min -> plancher 1
  expect(formatEcoule(5 * 60000)).toBe('5 min')
  expect(formatEcoule(90 * 60000)).toBe('1 heure')
  expect(formatEcoule(3 * 3600000)).toBe('3 heures')
  expect(formatEcoule(25 * 3600000)).toBe('1 jour')
  expect(formatEcoule(3 * 86400000)).toBe('3 jours')
  expect(formatEcoule(10 * 86400000)).toBe('1 semaine')
  expect(formatEcoule(20 * 86400000)).toBe('2 semaines')
  expect(formatEcoule(40 * 86400000)).toBe('1 mois')
  expect(formatEcoule(70 * 86400000)).toBe('2 mois')
})

const J = 86400000
const base = { relance_le: '2026-01-03T00:00:00.000Z' }

test('etatRappel : invisible avant l échéance', () => {
  const now = Date.parse('2026-01-02T00:00:00.000Z')
  expect(etatRappel({ ...base, vue_le: null }, now).visible).toBe(false)
})

test('etatRappel : dû et non-vu quand jamais consulté', () => {
  const now = Date.parse('2026-01-04T00:00:00.000Z')
  expect(etatRappel({ ...base, vue_le: null }, now)).toEqual({ visible: true, nonVu: true, reinitVue: false })
})

test('etatRappel : vu récemment reste grisé', () => {
  const vue = '2026-01-04T00:00:00.000Z'
  const now = Date.parse(vue) + 3 * J
  expect(etatRappel({ ...base, vue_le: vue }, now)).toEqual({ visible: true, nonVu: false, reinitVue: false })
})

test('etatRappel : réapparaît (non-vu) une semaine après consultation', () => {
  const vue = '2026-01-04T00:00:00.000Z'
  const now = Date.parse(vue) + 7 * J
  expect(etatRappel({ ...base, vue_le: vue }, now)).toEqual({ visible: true, nonVu: true, reinitVue: true })
})
