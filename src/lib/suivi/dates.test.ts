import { expect, test } from 'vitest'
import { ajouterJours, joursDepuis, estARelancer } from './dates'

test('ajouterJours décale la date et gère le passage de mois', () => {
  expect(ajouterJours('2026-07-10', 10)).toBe('2026-07-20')
  expect(ajouterJours('2026-07-25', 10)).toBe('2026-08-04')
})

test('joursDepuis compte les jours écoulés', () => {
  expect(joursDepuis('2026-07-10', '2026-07-10')).toBe(0)
  expect(joursDepuis('2026-07-10', '2026-07-13')).toBe(3)
})

test('estARelancer : postulee et échéance atteinte', () => {
  expect(estARelancer('postulee', '2026-07-20', '2026-07-20')).toBe(true)
  expect(estARelancer('postulee', '2026-07-20', '2026-07-25')).toBe(true)
  expect(estARelancer('postulee', '2026-07-20', '2026-07-19')).toBe(false)
  expect(estARelancer('entretien', '2026-07-20', '2026-07-25')).toBe(false)
  expect(estARelancer('postulee', null, '2026-07-25')).toBe(false)
})
