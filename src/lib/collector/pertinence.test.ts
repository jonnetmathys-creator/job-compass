import { expect, test } from 'vitest'
import { estPertinenteDietetique } from './pertinence'
import type { NormalizedOffer } from './types'

function offre(titre: string): NormalizedOffer {
  return {
    source: 'adzuna', source_id: '1', titre, entreprise: null, entreprise_logo: null,
    description: null, contrat: null, salaire: null, latitude: null, longitude: null,
    ville: null, url_postuler: null, email_contact: null, date_publication: null,
  }
}

test('garde les vrais intitulés de diététicien (avec ou sans accents)', () => {
  for (const t of [
    'Diététicien / Diététicienne',
    'Diététicien·ne Nutritionniste (H/F)',
    'Diététicien - Diététique F/H',
    'Diéteticien.ne - Pau (64)',
    'Dieteticien',
    'DIETETICIEN 11',
    'Conseiller Diététique H/F',
    'Diététicien(ne) H/F en médico social',
  ]) {
    expect(estPertinenteDietetique(offre(t)), t).toBe(true)
  }
})

test('écarte les métiers hors diététique remontés par le plein texte', () => {
  for (const t of [
    'INFIRMIER EN NUTRITION H/F',
    'Médecin nutritionniste',
    'Médecin SMR Nutrition (H/F)',
    'Ingénieur nutrition animale',
    'Responsable technique nutrition animale',
    'Commercial(e) – Perfusion & Nutrition',
    'Délégué Perfusion Nutrition H/F',
    'Psychologue clinicien',
    'Nutrition Intern',
    'Livreur Logisticien en Perfusion / Nutrition',
  ]) {
    expect(estPertinenteDietetique(offre(t)), t).toBe(false)
  }
})

test('titre vide ou absent : écarté', () => {
  expect(estPertinenteDietetique(offre(''))).toBe(false)
  expect(estPertinenteDietetique({ ...offre('x'), titre: undefined as any })).toBe(false)
})
