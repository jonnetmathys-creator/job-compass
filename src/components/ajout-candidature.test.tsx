import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import AjoutCandidature from './ajout-candidature'

const ajouterCandidatureManuelle = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/suivi/actions', () => ({
  ajouterCandidatureManuelle: (...a: unknown[]) => ajouterCandidatureManuelle(...a),
}))

test('ouvre le formulaire et soumet une candidature manuelle', async () => {
  const user = userEvent.setup()
  render(<AjoutCandidature />)
  await user.click(screen.getByRole('button', { name: /ajouter une candidature/i }))
  await user.type(screen.getByLabelText(/intitulé/i), 'Diététicien')
  await user.type(screen.getByLabelText(/entreprise/i), 'Clinique')
  await user.click(screen.getByRole('button', { name: /^ajouter$/i }))
  expect(ajouterCandidatureManuelle).toHaveBeenCalledWith(
    expect.objectContaining({ titre: 'Diététicien', entreprise: 'Clinique' }),
  )
})
