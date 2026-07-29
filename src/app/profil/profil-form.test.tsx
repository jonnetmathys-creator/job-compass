import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import ProfilForm from './profil-form'
import { upsertProfil } from '@/lib/profil'

vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({}),
}))

vi.mock('@/lib/profil', async () => {
  const actual = await vi.importActual<typeof import('@/lib/profil')>('@/lib/profil')
  return { ...actual, upsertProfil: vi.fn().mockResolvedValue({}) }
})

test('le formulaire pré-remplit les champs du profil', () => {
  render(<ProfilForm initial={{ user_id: 'u1', nom: 'Alice', titre_recherche: 'Diététicienne', cv_url: null, lettre_base: 'Bonjour', lettre_url: 'u1/lettre.pdf' }} />)
  expect(screen.getByLabelText(/nom/i)).toHaveValue('Alice')
  expect(screen.getByLabelText(/titre recherché/i)).toHaveValue('Diététicienne')
  expect(screen.getByText(/lettre actuelle/i)).toHaveTextContent('u1/lettre.pdf')
})

test('la soumission du formulaire enregistre les valeurs modifiées via upsertProfil', async () => {
  const user = userEvent.setup()
  render(<ProfilForm initial={{ user_id: 'u1', nom: 'Alice', titre_recherche: 'Diététicienne', cv_url: null, lettre_base: 'Bonjour', lettre_url: null }} />)

  await user.clear(screen.getByLabelText(/nom/i))
  await user.type(screen.getByLabelText(/nom/i), 'Alice Dupont')

  await user.clear(screen.getByLabelText(/titre recherché/i))
  await user.type(screen.getByLabelText(/titre recherché/i), 'Diététicienne senior')

  await user.click(screen.getByRole('button', { name: /enregistrer/i }))

  expect(upsertProfil).toHaveBeenCalledWith(
    {},
    'u1',
    {
      nom: 'Alice Dupont',
      titre_recherche: 'Diététicienne senior',
    },
  )
})
