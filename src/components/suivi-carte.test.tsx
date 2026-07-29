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
  genererRelance: vi.fn().mockResolvedValue({ objet: 'R', corps: 'C' }),
  enregistrerRelance: vi.fn(),
  supprimerCandidature: vi.fn(),
}))

const item: CandidatureSuivi = {
  offre: {
    id: 'o1', source: 'x', source_id: 'x', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
    description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: 'Nantes',
    url_postuler: null, email_contact: null, date_publication: null,
  },
  statut: 'postulee', postulee_le: '2026-07-10', relance_le: null, notes: null,
  relance_objet: null, relance_corps: null,
}

test('affiche le titre, l\'employeur et un sélecteur de statut', () => {
  render(<SuiviCarte item={item} today="2026-07-20" />)
  expect(screen.getByText('Diététicien')).toBeInTheDocument()
  expect(screen.getByText(/Clinique/)).toBeInTheDocument()
  expect(screen.getByLabelText(/statut/i)).toBeInTheDocument()
})

test('changer le statut appelle changerStatut', async () => {
  const user = userEvent.setup()
  render(<SuiviCarte item={item} today="2026-07-20" />)
  await user.selectOptions(screen.getByLabelText(/statut/i), 'entretien')
  expect(changerStatut).toHaveBeenCalledWith('o1', 'entretien')
})

test('affiche « postulé il y a X jours »', () => {
  render(<SuiviCarte item={{ ...item, postulee_le: '2026-07-10' }} today="2026-07-13" />)
  expect(screen.getByText(/postulé il y a 3 jours/i)).toBeInTheDocument()
})

test('badge « à relancer » quand la date de relance est atteinte', () => {
  render(<SuiviCarte item={{ ...item, statut: 'postulee', relance_le: '2026-07-15' }} today="2026-07-20" />)
  expect(screen.getByText(/à relancer/i)).toBeInTheDocument()
})

test('bouton « Générer un mail de relance » présent pour une candidature postulée', () => {
  render(<SuiviCarte item={{ ...item, statut: 'postulee' }} today="2026-07-20" />)
  expect(screen.getByRole('button', { name: /mail de relance/i })).toBeInTheDocument()
})
