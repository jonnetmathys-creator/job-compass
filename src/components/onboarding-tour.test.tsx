import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import OnboardingTour from './onboarding-tour'

const { flag } = vi.hoisted(() => ({ flag: { termine: false } }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))
vi.mock('@/lib/onboarding/lecture', () => ({
  estOnboardingTermine: vi.fn(async () => flag.termine),
}))
vi.mock('@/lib/onboarding/actions', () => ({ terminerOnboarding: vi.fn() }))
vi.mock('@/lib/recherche/actions', () => ({ lancerRecherche: vi.fn() }))

test('flag terminé -> aucune visite affichée', async () => {
  flag.termine = true
  localStorage.clear(); document.body.innerHTML = ''
  render(<OnboardingTour />)
  await waitFor(() => {}) // laisse l'effet asynchrone s'exécuter
  // le projecteur est rendu en portail dans document.body : on interroge tout le document
  expect(screen.queryByText('Commence ici')).toBeNull()
})

test('flag non terminé -> démarre sur la première étape', async () => {
  flag.termine = false
  localStorage.clear()
  // la cible de l'étape 1 doit exister pour que la bulle (et non la pause) s'affiche
  document.body.innerHTML = '<form data-tour="recherche"></form>'
  render(<OnboardingTour />)
  await waitFor(() => expect(screen.getByText('Commence ici')).toBeInTheDocument())
})
