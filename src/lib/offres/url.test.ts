import { expect, test } from 'vitest'
import { urlPostulerSure } from './url'

test('laisse passer http et https', () => {
  expect(urlPostulerSure('https://exemple.fr/offre')).toBe('https://exemple.fr/offre')
  expect(urlPostulerSure('http://exemple.fr')).toBe('http://exemple.fr')
})

test('rejette javascript:, data: et autres protocoles', () => {
  expect(urlPostulerSure('javascript:alert(1)')).toBeNull()
  expect(urlPostulerSure('data:text/html,<script>1</script>')).toBeNull()
  expect(urlPostulerSure('ftp://exemple.fr')).toBeNull()
})

test('rejette null, vide et non-URL', () => {
  expect(urlPostulerSure(null)).toBeNull()
  expect(urlPostulerSure('')).toBeNull()
  expect(urlPostulerSure('pas une url')).toBeNull()
})
