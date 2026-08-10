import { expect, test } from 'vitest'
import { chunk } from './chunk'

test('découpe en lots de la taille demandée', () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
})

test('tableau vide -> aucun lot', () => {
  expect(chunk([], 100)).toEqual([])
})

test('tableau plus petit que le lot -> un seul lot', () => {
  expect(chunk(['a'], 100)).toEqual([['a']])
})

test('taille invalide lève', () => {
  expect(() => chunk([1], 0)).toThrow()
})
