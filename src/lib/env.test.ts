import { expect, test, afterEach } from 'vitest'
import { requireEnv } from './env'

afterEach(() => { delete process.env.TEST_VAR })

test('requireEnv renvoie la valeur quand elle existe', () => {
  process.env.TEST_VAR = 'ok'
  expect(requireEnv('TEST_VAR')).toBe('ok')
})

test('requireEnv lève une erreur explicite quand absente', () => {
  expect(() => requireEnv('TEST_VAR')).toThrow(/TEST_VAR/)
})
