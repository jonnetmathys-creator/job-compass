import { expect, test } from 'vitest'
// Écart au brief : buildRechercheInsert vit dans ./build.ts (non 'use server'),
// pas dans ./actions.ts, car un fichier 'use server' ne peut exporter que des
// fonctions async (contrainte Next.js). Voir build.ts pour le détail.
import { buildRechercheInsert } from './build'

test('construit la ligne recherche : poste en intitulé et mot-clé, localisation nulle', () => {
  const row = buildRechercheInsert('user-1', '  Diététicien ')
  expect(row).toEqual({
    user_id: 'user-1', intitule: 'Diététicien', mots_cles: ['Diététicien'],
    localisation: null, rayon_km: null, type_contrat: null,
  })
})
