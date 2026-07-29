import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import LettreImprimable from './lettre-imprimable'
import type { OffreRow } from '@/lib/offres/types'

const offre = {
  id: 'o1', source: 'x', source_id: 'x', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
  description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: 'Nantes',
  url_postuler: null, email_contact: null, date_publication: null,
} as OffreRow

test('rend le texte de la lettre dans un conteneur imprimable', () => {
  render(<LettreImprimable lettre={'Madame, Monsieur,\n\nJe me permets…'} offre={offre} />)
  const bloc = screen.getByTestId('lettre-imprimable')
  expect(bloc).toHaveClass('lettre-imprimable')
  expect(bloc.textContent).toContain('Je me permets')
})
