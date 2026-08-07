import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import OnboardingTour from './onboarding-tour'

const { flag, pathnameState } = vi.hoisted(() => ({
  flag: { termine: false },
  pathnameState: { valeur: '/' },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.valeur,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))
vi.mock('@/lib/onboarding/lecture', () => ({
  estOnboardingTermine: vi.fn(async () => flag.termine),
}))
vi.mock('@/lib/onboarding/actions', () => ({ terminerOnboarding: vi.fn() }))
vi.mock('@/lib/recherche/actions', () => ({ lancerRecherche: vi.fn(async () => {}) }))

test('flag terminé -> aucune visite affichée', async () => {
  flag.termine = true
  pathnameState.valeur = '/'
  localStorage.clear(); document.body.innerHTML = ''
  render(<OnboardingTour />)
  await waitFor(() => {}) // laisse l'effet asynchrone s'exécuter
  // le projecteur est rendu en portail dans document.body : on interroge tout le document
  expect(screen.queryByText('Commence ici')).toBeNull()
})

test('flag non terminé -> démarre sur la première étape', async () => {
  flag.termine = false
  pathnameState.valeur = '/'
  localStorage.clear()
  // la cible de l'étape 1 doit exister pour que la bulle (et non la pause) s'affiche
  document.body.innerHTML = '<form data-tour="recherche"></form>'
  render(<OnboardingTour />)
  await waitFor(() => expect(screen.getByText('Commence ici')).toBeInTheDocument())
})

test('recherche lancée -> overlay affiché puis refermé après la navigation', async () => {
  flag.termine = false
  pathnameState.valeur = '/'
  localStorage.clear()
  document.body.innerHTML = '<form data-tour="recherche"></form>'
  const { rerender } = render(<OnboardingTour />)
  await waitFor(() => expect(screen.getByText('Commence ici')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
  await waitFor(() => expect(screen.getByText('Exploration des offres…')).toBeInTheDocument())

  // La redirection de lancerRecherche() arrive sur /recherche/[id] : l'overlay doit se refermer.
  pathnameState.valeur = '/recherche/abc'
  rerender(<OnboardingTour />)
  await waitFor(() => expect(screen.queryByText('Exploration des offres…')).toBeNull())
})

test('collecte vide -> étape « like » sautée vers « cloche » au lieu de rester en pause', async () => {
  flag.termine = false
  pathnameState.valeur = '/recherche/abc'
  localStorage.clear()
  localStorage.setItem('jc_tour_index', '5') // étape « like »
  // Page de résultats vide : la cloche (toujours présente) existe, mais ni la carte « like »
  // ni aucune offre (`[data-offre-id]`) ne sont rendues.
  document.body.innerHTML = '<button data-tour="cloche"></button>'
  render(<OnboardingTour />)
  expect(document.querySelector('[data-offre-id]')).toBeNull()
  await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument(), { timeout: 4000 })
  expect(screen.queryByText('Sauvegarde')).toBeNull()
  expect(screen.queryByText('Passer le tutoriel')).toBeNull()
}, 10000)
