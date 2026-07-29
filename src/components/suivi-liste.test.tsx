import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import SuiviListe from './suivi-liste'
import type { CandidatureSuivi } from '@/lib/suivi/lecture'

vi.mock('@/lib/suivi/actions', () => ({
  changerStatut: vi.fn(), enregistrerSuivi: vi.fn(),
}))

function item(id: string, statut: string): CandidatureSuivi {
  return {
    offre: {
      id, source: 'x', source_id: id, titre: `Offre ${id}`, entreprise: 'E', entreprise_logo: null,
      description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: null,
      url_postuler: null, email_contact: null, date_publication: null,
    },
    statut, postulee_le: '2026-07-10', relance_le: null, notes: null,
  }
}

test('état vide quand aucune candidature', () => {
  render(<SuiviListe items={[]} />)
  expect(screen.getByText(/aucune candidature/i)).toBeInTheDocument()
})

test('affiche les compteurs et une section par statut présent', () => {
  render(<SuiviListe items={[item('a', 'postulee'), item('b', 'entretien'), item('c', 'entretien')]} />)
  // section Entretien avec 2 éléments
  expect(screen.getByRole('heading', { name: /entretien/i })).toBeInTheDocument()
  // compteur « En cours » = postulee + entretien = 3
  expect(screen.getByText('En cours').previousSibling?.textContent ?? screen.getByText('En cours').parentElement?.textContent).toContain('3')
  // pas de section Refusée (aucun élément)
  expect(screen.queryByRole('heading', { name: /refusée/i })).toBeNull()
})
