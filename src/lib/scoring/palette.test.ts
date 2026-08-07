import { expect, test } from 'vitest'
import { couleurScore, estTopMatch } from './palette'

test('couleurScore vire au rouge en bas, au vert en haut', () => {
  const t = (s: string) => Number(s.match(/hsl\((\d+)/)![1])
  expect(couleurScore(10)).toContain('hsl(')
  expect(t(couleurScore(95))).toBeGreaterThan(t(couleurScore(10)))
})

test('estTopMatch vrai à partir de 90', () => {
  expect(estTopMatch(90)).toBe(true)
  expect(estTopMatch(89)).toBe(false)
})
