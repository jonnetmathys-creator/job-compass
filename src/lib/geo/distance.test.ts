import { expect, test } from 'vitest'
import { distanceKm, filtrerDansRayon } from './distance'
import type { OffreRow } from '@/lib/offres/types'

test('distanceKm : Nantes -> Rennes ~ 100 km', () => {
  const d = distanceKm({ lat: 47.2184, lng: -1.5536 }, { lat: 48.1173, lng: -1.6778 })
  expect(d).toBeGreaterThan(95); expect(d).toBeLessThan(115)
})

const o = (id: string, lat: number | null, lng: number | null, ville: string | null): OffreRow => ({
  id, source: 'ft', source_id: id, titre: 't', entreprise: null, entreprise_logo: null, description: null,
  contrat: null, salaire: null, latitude: lat, longitude: lng, ville, url_postuler: null, email_contact: null,
  date_publication: null,
})

test('filtrerDansRayon : garde Nantes dans 50km, exclut Rennes', () => {
  const centre = { lat: 47.2184, lng: -1.5536 }
  const out = filtrerDansRayon([o('nantes', 47.21, -1.55, null), o('rennes', 48.11, -1.67, null)], centre, 50)
  expect(out.map((x) => x.id)).toEqual(['nantes'])
})

test('filtrerDansRayon : offre sans position exclue', () => {
  const out = filtrerDansRayon([o('x', null, null, 'Lieu inconnu')], { lat: 47, lng: -1 }, 50)
  expect(out).toEqual([])
})
