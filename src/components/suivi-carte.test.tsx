import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import SuiviCarte from './suivi-carte'
import type { CandidatureSuivi } from '@/lib/suivi/lecture'

const changerStatut = vi.fn().mockResolvedValue(undefined)
const enregistrerSuivi = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/suivi/actions', () => ({
  changerStatut: (...a: unknown[]) => changerStatut(...a),
  enregistrerSuivi: (...a: unknown[]) => enregistrerSuivi(...a),
}))

const item: CandidatureSuivi = {
  offre: {
    id: 'o1', source: 'x', source_id: 'x', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
    description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: 'Nantes',
    url_postuler: null, email_contact: null, date_publication: null,
  },
  statut: 'postulee', postulee_le: '2026-07-10', relance_le: null, notes: null,
}

test('affiche le titre, l\'employeur et un sélecteur de statut', () => {
  render(<SuiviCarte item={item} />)
  expect(screen.getByText('Diététicien')).toBeInTheDocument()
  expect(screen.getByText(/Clinique/)).toBeInTheDocument()
  expect(screen.getByLabelText(/statut/i)).toBeInTheDocument()
})

test('changer le statut appelle changerStatut', async () => {
  const user = userEvent.setup()
  render(<SuiviCarte item={item} />)
  await user.selectOptions(screen.getByLabelText(/statut/i), 'entretien')
  expect(changerStatut).toHaveBeenCalledWith('o1', 'entretien')
})
