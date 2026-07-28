import { expect, test } from 'vitest'
import { sortByDateDesc } from './offres'
import type { OffreRow } from '@/lib/offres/types'

const base: Omit<OffreRow, 'id' | 'date_publication'> = {
  source: 'france_travail', source_id: 'x', titre: 't', entreprise: null, entreprise_logo: null,
  description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: null,
  url_postuler: null, email_contact: null,
}
const o = (id: string, d: string | null): OffreRow => ({ ...base, id, date_publication: d })

test('trie par date de publication décroissante', () => {
  const out = sortByDateDesc([o('a', '2026-01-01'), o('b', '2026-03-01'), o('c', '2026-02-01')])
  expect(out.map((x) => x.id)).toEqual(['b', 'c', 'a'])
})

test('place les dates nulles en fin', () => {
  const out = sortByDateDesc([o('a', null), o('b', '2026-01-01'), o('c', null)])
  expect(out.map((x) => x.id)).toEqual(['b', 'a', 'c'])
})
