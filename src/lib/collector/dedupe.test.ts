import { expect, test } from 'vitest'
import { dedupeOffres } from './dedupe'
import type { NormalizedOffer } from './types'

function o(source: string, id: string): NormalizedOffer {
  return {
    source, source_id: id, titre: `${source}-${id}`, entreprise: null, description: null,
    contrat: null, salaire: null, latitude: null, longitude: null, ville: null,
    url_postuler: null, email_contact: null, date_publication: null,
  }
}

test('dédoublonne sur (source, source_id) et fusionne les listes', () => {
  const ft = [o('france_travail', '1'), o('france_travail', '1'), o('france_travail', '2')]
  const az = [o('adzuna', '1')] // même id mais source différente = offre distincte
  const merged = dedupeOffres(ft, az)
  expect(merged).toHaveLength(3)
  const keys = merged.map((x) => `${x.source}:${x.source_id}`)
  expect(keys).toContain('france_travail:1')
  expect(keys).toContain('france_travail:2')
  expect(keys).toContain('adzuna:1')
})
