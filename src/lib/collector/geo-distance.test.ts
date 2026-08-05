import { expect, test } from 'vitest'
import { distanceKm } from './geo-distance'

test('distanceKm vaut 0 pour un même point', () => {
  expect(distanceKm({ lat: 47.2, lng: -1.55 }, { lat: 47.2, lng: -1.55 })).toBe(0)
})

test('distanceKm Nantes-Rennes est de l’ordre de 100 km', () => {
  const d = distanceKm({ lat: 47.218, lng: -1.554 }, { lat: 48.117, lng: -1.677 })
  expect(d).toBeGreaterThan(95)
  expect(d).toBeLessThan(115)
})
