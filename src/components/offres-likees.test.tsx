import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import OffresLikees from './offres-likees'
import type { OffreRow } from '@/lib/offres/types'

const o = (id: string, titre: string): OffreRow => ({
  id, source: 'ft', source_id: id, titre, entreprise: 'E', entreprise_logo: null, description: null,
  contrat: 'CDI', salaire: null, latitude: null, longitude: null, ville: '44 - NANTES',
  url_postuler: null, email_contact: null, date_publication: '2026-01-01',
})

test('liste les offres likées', () => {
  render(<OffresLikees offres={[o('1', 'Diététicien'), o('2', 'Nutritionniste')]} />)
  expect(screen.getByText('Diététicien')).toBeInTheDocument()
  expect(screen.getByText('Nutritionniste')).toBeInTheDocument()
})

test('affiche un état vide sans offre likée', () => {
  render(<OffresLikees offres={[]} />)
  expect(screen.getByText(/aucune offre likée/i)).toBeInTheDocument()
})
