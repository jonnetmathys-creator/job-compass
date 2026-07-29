import { expect, test } from 'vitest'
import { codeDepartement, positionEpingle, PREFECTURES } from './departements'

test('lit le code département depuis un libellé "44 - NANTES"', () => {
  expect(codeDepartement({ ville: '44 - NANTES' })).toBe('44')
})

test('gère la Corse "2A - AJACCIO"', () => {
  expect(codeDepartement({ ville: '2A - AJACCIO' })).toBe('2A')
})

test('renvoie null si aucun code lisible', () => {
  expect(codeDepartement({ ville: 'Nantes' })).toBeNull()
  expect(codeDepartement({ ville: null })).toBeNull()
})

test('positionEpingle : coordonnées réelles prioritaires', () => {
  expect(positionEpingle({ latitude: 47.1, longitude: -1.5, ville: '44 - NANTES' })).toEqual({ lat: 47.1, lng: -1.5 })
})

test('positionEpingle : repli sur la préfecture du département', () => {
  const pos = positionEpingle({ latitude: null, longitude: null, ville: '44 - NANTES' })
  expect(pos).toEqual({ lat: PREFECTURES['44'].lat, lng: PREFECTURES['44'].lng })
})

test('positionEpingle : null si ni coords ni département', () => {
  expect(positionEpingle({ latitude: null, longitude: null, ville: 'Lieu inconnu' })).toBeNull()
})
