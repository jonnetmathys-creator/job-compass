import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import CandidatureEditor from './candidature-editor'
import type { OffreRow } from '@/lib/offres/types'

vi.mock('@/lib/candidature/actions', () => ({
  genererCandidature: vi.fn(),
  enregistrerCandidature: vi.fn(),
  retoucherLettre: vi.fn(),
}))

vi.mock('@/lib/suivi/actions', () => ({
  marquerPostulee: vi.fn(),
  retirerDuSuivi: vi.fn(),
}))

const offre = {
  id: 'o1', source: 'x', source_id: 'x', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
  description: null, contrat: 'CDI', salaire: null, latitude: null, longitude: null, ville: 'Nantes',
  url_postuler: null, email_contact: null, date_publication: null,
} as OffreRow

const expediteur = { nom: 'Mathys Jonnet', adresse: '', codePostal: '', ville: '', telephone: '', email: '' }
const dateFr = '01/09/2026'

test('profil incomplet : message + lien vers le profil, pas de bouton Générer', () => {
  render(<CandidatureEditor offre={offre} profilComplet={false} candidatureInitiale={null} expediteur={expediteur} dateFr={dateFr} />)
  expect(screen.getByText(/ton profil/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /profil/i })).toHaveAttribute('href', '/profil')
  expect(screen.queryByRole('button', { name: /générer/i })).toBeNull()
})

test('profil complet sans candidature : bouton Générer', () => {
  render(<CandidatureEditor offre={offre} profilComplet={true} candidatureInitiale={null} expediteur={expediteur} dateFr={dateFr} />)
  expect(screen.getByRole('button', { name: /générer ma candidature/i })).toBeInTheDocument()
})

test('candidature présente : onglets, actions IA, et email accessible via son onglet', () => {
  const cand = { user_id: 'u1', offre_id: 'o1', email_objet: 'Objet', email_corps: 'Corps', lettre: 'Ma lettre', statut: 'brouillon' }
  render(<CandidatureEditor offre={offre} profilComplet={true} candidatureInitiale={cand} expediteur={expediteur} dateFr={dateFr} />)

  // Onglet Lettre par défaut : barre d'outils + actions IA visibles.
  expect(screen.getByRole('button', { name: /régénérer/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /raccourcir/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /corriger/i })).toBeInTheDocument()
  // L'objet de l'email n'est pas encore rendu (onglet Lettre).
  expect(screen.queryByLabelText('Objet')).toBeNull()

  // Bascule vers l'onglet Email.
  fireEvent.click(screen.getByRole('button', { name: 'Email' }))
  expect((screen.getByLabelText('Objet') as HTMLInputElement).value).toBe('Objet')
  expect((screen.getByLabelText(/corps de l'email/i) as HTMLTextAreaElement).value).toBe('Corps')
  expect(screen.getByRole('button', { name: /copier l'email/i })).toBeInTheDocument()
})
