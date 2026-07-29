import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import CandidatureEditor from './candidature-editor'
import type { OffreRow } from '@/lib/offres/types'

vi.mock('@/lib/candidature/actions', () => ({
  genererCandidature: vi.fn(),
  enregistrerCandidature: vi.fn(),
}))

const offre = {
  id: 'o1', source: 'x', source_id: 'x', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
  description: null, contrat: 'CDI', salaire: null, latitude: null, longitude: null, ville: 'Nantes',
  url_postuler: null, email_contact: null, date_publication: null,
} as OffreRow

test('profil incomplet : message + lien vers le profil, pas de bouton Générer', () => {
  render(<CandidatureEditor offre={offre} profilComplet={false} candidatureInitiale={null} />)
  expect(screen.getByText(/ton profil/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /profil/i })).toHaveAttribute('href', '/profil')
  expect(screen.queryByRole('button', { name: /générer/i })).toBeNull()
})

test('profil complet sans candidature : bouton Générer', () => {
  render(<CandidatureEditor offre={offre} profilComplet={true} candidatureInitiale={null} />)
  expect(screen.getByRole('button', { name: /générer ma candidature/i })).toBeInTheDocument()
})

test('candidature présente : champs éditables + boutons copier', () => {
  const cand = { user_id: 'u1', offre_id: 'o1', email_objet: 'Objet', email_corps: 'Corps', lettre: 'Ma lettre', statut: 'brouillon' }
  render(<CandidatureEditor offre={offre} profilComplet={true} candidatureInitiale={cand} />)
  expect((screen.getByLabelText(/objet/i) as HTMLInputElement).value).toBe('Objet')
  expect((screen.getByLabelText(/corps de l'email/i) as HTMLTextAreaElement).value).toBe('Corps')
  expect((screen.getByLabelText(/lettre/i) as HTMLTextAreaElement).value).toBe('Ma lettre')
  expect(screen.getByRole('button', { name: /copier l'email/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /copier la lettre/i })).toBeInTheDocument()
})
