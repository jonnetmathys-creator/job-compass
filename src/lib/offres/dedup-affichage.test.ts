import { expect, test } from 'vitest'
import { dedupeAffichage, similariteTitre } from './dedup-affichage'
import type { OffreRow } from './types'

const DESC_A = 'Le service recherche un professionnel motive pour assurer le suivi nutritionnel des patients hospitalises au quotidien avec rigueur et bienveillance'
const DESC_B = 'Poste de cuisinier en restauration collective pour preparer les repas des residents chaque midi et soir dans le respect des regles'

function o(p: Partial<OffreRow> & { id: string; source: string }): OffreRow {
  return {
    id: p.id, source: p.source, source_id: p.id, titre: p.titre ?? 'Diététicien H/F',
    entreprise: p.entreprise === undefined ? 'CH Le Mans' : p.entreprise, entreprise_logo: null, description: p.description ?? null,
    contrat: null, salaire: null, latitude: p.latitude ?? null, longitude: p.longitude ?? null,
    ville: p.ville === undefined ? 'Le Mans' : p.ville, url_postuler: null,
    email_contact: p.email_contact === undefined ? null : p.email_contact,
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

test('similariteTitre : identiques = 1, variante ≥ 0,6, poste distinct < 0,6', () => {
  expect(similariteTitre('Diététicien', 'Diététicien')).toBe(1)
  expect(similariteTitre('Diététicien H/F', 'Diététicien nutritionniste')).toBeGreaterThanOrEqual(0.6)
  expect(similariteTitre('Diététicien', 'Diététicien coordinateur de service')).toBeLessThan(0.6)
})

test('fusionne des titres différents au même employeur + ville', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail', titre: 'Diététicien H/F' }),
    o({ id: '2', source: 'afdn', titre: 'Diététicien nutritionniste' }),
  ])
  expect(out).toHaveLength(1)
  expect(out[0].plateformes).toEqual(['France Travail', 'AFDN'])
})

test('fusionne via la description quand le lieu manque et le titre diffère', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail', titre: 'Diététicien H/F', entreprise: null, ville: null, description: DESC_A }),
    o({ id: '2', source: 'afdn', titre: 'Poste en nutrition clinique', entreprise: null, ville: null, description: DESC_A }),
  ])
  expect(out).toHaveLength(1)
})

test('ne fusionne pas deux rôles distincts au même employeur (titre et description éloignés)', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail', titre: 'Diététicien H/F', description: DESC_A }),
    o({ id: '2', source: 'france_travail', titre: 'Cuisinier H/F', description: DESC_B }),
  ])
  expect(out).toHaveLength(2)
})

test('fusionne par email de contact identique malgré des titres différents', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail', titre: 'Diététicien H/F', ville: null, email_contact: 'rh@ch-lemans.fr' }),
    o({ id: '2', source: 'afdn', titre: 'Nutritionniste clinique', ville: null, email_contact: 'rh@ch-lemans.fr' }),
  ])
  expect(out).toHaveLength(1)
})

test('ne fusionne pas deux offres sans employeur ni lieu aux titres et descriptions différents', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail', titre: 'Diététicien H/F', entreprise: null, ville: null, description: DESC_A }),
    o({ id: '2', source: 'afdn', titre: 'Cuisinier H/F', entreprise: null, ville: null, description: DESC_B }),
  ])
  expect(out).toHaveLength(2)
})
