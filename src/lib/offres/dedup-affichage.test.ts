import { expect, test } from 'vitest'
import { dedupeAffichage } from './dedup-affichage'
import type { OffreRow } from './types'

function o(p: Partial<OffreRow> & { id: string; source: string }): OffreRow {
  return {
    id: p.id, source: p.source, source_id: p.id, titre: p.titre ?? 'Diététicien H/F',
    entreprise: p.entreprise === undefined ? 'CH Le Mans' : p.entreprise, entreprise_logo: null, description: p.description ?? null,
    contrat: null, salaire: null, latitude: p.latitude ?? null, longitude: p.longitude ?? null,
    ville: p.ville ?? 'Le Mans', url_postuler: null, email_contact: null,
    date_publication: p.date_publication ?? null,
  }
}

test('fusionne deux sources du même poste et liste les plateformes', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail' }),
    o({ id: '2', source: 'staffsante' }),
  ])
  expect(out).toHaveLength(1)
  expect(out[0].plateformes).toEqual(['France Travail', 'StaffSanté'])
})

test('normalise le titre (H/F, casse, ponctuation)', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail', titre: 'Diététicien H/F' }),
    o({ id: '2', source: 'adzuna', titre: 'DIETETICIEN (H/F)' }),
  ])
  expect(out).toHaveLength(1)
})

test('ne fusionne pas des villes différentes', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail', ville: 'Le Mans' }),
    o({ id: '2', source: 'staffsante', ville: 'Nantes' }),
  ])
  expect(out).toHaveLength(2)
})

test('garde la représentante avec coordonnées', () => {
  const out = dedupeAffichage([
    o({ id: 'sans', source: 'france_travail', latitude: null, longitude: null }),
    o({ id: 'avec', source: 'staffsante', latitude: 48, longitude: 0 }),
  ])
  expect(out).toHaveLength(1)
  expect(out[0].id).toBe('avec')
  expect(out[0].plateformes[0]).toBe('StaffSanté') // source de la représentante en tête
})

test('une entreprise nulle ne fusionne pas avec une entreprise renseignée', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'afdn', entreprise: null }),
    o({ id: '2', source: 'france_travail', entreprise: 'CH Le Mans' }),
  ])
  expect(out).toHaveLength(2)
})

test('préserve l’ordre d’entrée des représentantes', () => {
  const out = dedupeAffichage([
    o({ id: 'a', source: 'france_travail', titre: 'Poste A', ville: 'Nantes' }),
    o({ id: 'b', source: 'france_travail', titre: 'Poste B', ville: 'Rennes' }),
  ])
  expect(out.map((x) => x.id)).toEqual(['a', 'b'])
})
