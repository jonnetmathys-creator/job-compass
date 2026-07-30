import { expect, test, vi } from 'vitest'
import { estOnboardingTermine } from './lecture'

function clientAvec(row: { onboarding_termine: boolean } | null) {
  return {
    from: vi.fn((..._args: unknown[]) => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }),
    })),
  } as never
}

test('renvoie false quand aucune ligne profil', async () => {
  expect(await estOnboardingTermine(clientAvec(null), 'u1')).toBe(false)
})

test('renvoie la valeur du flag quand la ligne existe', async () => {
  expect(await estOnboardingTermine(clientAvec({ onboarding_termine: true }), 'u1')).toBe(true)
  expect(await estOnboardingTermine(clientAvec({ onboarding_termine: false }), 'u1')).toBe(false)
})
