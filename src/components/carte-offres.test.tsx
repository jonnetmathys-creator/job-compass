import { expect, test } from 'vitest'
import { pointsFor } from './carte-offres'
import type { OffreRow } from '@/lib/offres/types'

const base: Omit<OffreRow, 'id' | 'latitude' | 'longitude' | 'ville'> = {
  source: 'ft', source_id: 'x', titre: 't', entreprise: null, entreprise_logo: null, description: null,
  contrat: null, salaire: null, url_postuler: null, email_contact: null, date_publication: null,
}

test('exclut les offres sans position géolocalisable', () => {
  const offres: OffreRow[] = [
    { ...base, id: 'a', latitude: 47, longitude: -1, ville: null },
    { ...base, id: 'b', latitude: null, longitude: null, ville: 'Lieu inconnu' },
    { ...base, id: 'c', latitude: null, longitude: null, ville: '44 - NANTES' },
  ]
  const pts = pointsFor(offres)
  expect(pts.map((p) => p.id).sort()).toEqual(['a', 'c'])
})
