import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import ClocheNotifs from './cloche-notifs'

const { mockBoite } = vi.hoisted(() => ({
  mockBoite: [
    { offre: { id: 'o1', titre: 'Diététicien', entreprise: 'Clinique', ville: 'Nantes' }, created_at: '2026-07-29T10:00:00Z', vue_le: null },
  ],
}))
vi.mock('@/lib/alertes/boite', () => ({
  getBoite: vi.fn().mockResolvedValue(mockBoite),
  compterNonVues: vi.fn().mockResolvedValue(1),
  marquerOffreVue: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))
vi.mock('@/lib/alertes/actions', () => ({ marquerVue: vi.fn() }))

test('affiche la pastille avec le nombre de non vues', async () => {
  render(<ClocheNotifs />)
  expect(await screen.findByText('1')).toBeInTheDocument()
})

test('le panneau liste les nouvelles offres', async () => {
  render(<ClocheNotifs />)
  await waitFor(() => expect(screen.getByText('Diététicien')).toBeInTheDocument())
})
