import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import LettreImprimable, { type Expediteur } from './lettre-imprimable'
import type { OffreRow } from '@/lib/offres/types'

const offre = {
  id: 'o1', source: 'x', source_id: 'x', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
  description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: 'Nantes',
  url_postuler: null, email_contact: null, date_publication: null,
} as OffreRow

const expediteur: Expediteur = {
  nom: 'Mathys Jonnet', adresse: '12 rue des Lilas', codePostal: '44000', ville: 'Nantes',
  telephone: '06 12 34 56 78', email: 'mathys@email.com',
}

test('rend le texte de la lettre dans un conteneur imprimable', () => {
  render(<LettreImprimable lettre={'Madame, Monsieur,\n\nJe me permets…'} offre={offre} expediteur={expediteur} dateFr="01/09/2026" />)
  const bloc = screen.getByTestId('lettre-imprimable')
  expect(bloc).toHaveClass('lettre-imprimable')
  expect(bloc.textContent).toContain('Je me permets')
})

test("affiche l'en-tête expéditeur, la date et l'objet", () => {
  render(<LettreImprimable lettre={'Madame, Monsieur,'} offre={offre} expediteur={expediteur} dateFr="01/09/2026" />)
  const bloc = screen.getByTestId('lettre-imprimable')
  expect(bloc.textContent).toContain('Mathys Jonnet')
  expect(bloc.textContent).toContain('44000 Nantes')
  expect(bloc.textContent).toContain('06 12 34 56 78')
  expect(bloc.textContent).toContain('À Nantes, le 01/09/2026')
  expect(bloc.textContent).toContain('Objet : candidature au poste de Diététicien')
})
