import { expect, test, vi } from 'vitest'
import { collectForRecherche } from './collect'
import type { NormalizedOffer } from './types'

function o(source: string, id: string): NormalizedOffer {
  return {
    source, source_id: id, titre: 'T', entreprise: null, entreprise_logo: null, description: null, contrat: null,
    salaire: null, latitude: null, longitude: null, ville: null, url_postuler: null,
    email_contact: null, date_publication: null,
  }
}

test('collecte des trois sources, dédoublonne, écrit et relie', async () => {
  const recherche = {
    id: 'rech-1', mots_cles: [], localisation: '44109',
    rayon_km: 30, type_contrat: null,
  }
  const storeOffres = vi.fn().mockResolvedValue([
    { id: 'u1', source: 'france_travail', source_id: '1' },
    { id: 'u2', source: 'adzuna', source_id: '9' },
    { id: 'u3', source: 'jooble', source_id: '5' },
  ])
  const linkResultats = vi.fn().mockResolvedValue(undefined)
  const res = await collectForRecherche({} as any, recherche, {
    searchFranceTravail: vi.fn().mockResolvedValue([o('france_travail', '1')]),
    searchAdzuna: vi.fn().mockResolvedValue([o('adzuna', '9')]),
    searchJooble: vi.fn().mockResolvedValue([o('jooble', '5')]),
    storeOffres,
    linkResultats,
  })
  expect(storeOffres).toHaveBeenCalledOnce()
  expect(storeOffres.mock.calls[0][1]).toHaveLength(3) // 3 offres dédoublonnées
  expect(linkResultats).toHaveBeenCalledWith(expect.anything(), 'rech-1', expect.any(Array))
  expect(res).toMatchObject({ collected: 3, linked: 3 })
})

test('une source qui échoue n’empêche pas les autres', async () => {
  const recherche = {
    id: 'rech-1', mots_cles: [], localisation: null,
    rayon_km: null, type_contrat: null,
  }
  const res = await collectForRecherche({} as any, recherche, {
    searchFranceTravail: vi.fn().mockRejectedValue(new Error('FT down')),
    searchAdzuna: vi.fn().mockResolvedValue([o('adzuna', '9')]),
    searchJooble: vi.fn().mockRejectedValue(new Error('Jooble down')),
    storeOffres: vi.fn().mockResolvedValue([{ id: 'u2', source: 'adzuna', source_id: '9' }]),
    linkResultats: vi.fn().mockResolvedValue(undefined),
  })
  expect(res.collected).toBe(1)
})
