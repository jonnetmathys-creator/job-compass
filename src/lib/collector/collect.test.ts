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

test('collecte les sources, ajoute les offres scrapées, dédoublonne, écrit et relie', async () => {
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
    offresScrapees: vi.fn().mockResolvedValue([{ id: 'sc1', source: 'afdn', source_id: 'slug-1' }]),
    storeOffres,
    linkResultats,
  })
  // 3 offres stockées + 1 scrapée reliées
  expect(linkResultats.mock.calls[0][2]).toHaveLength(4)
  expect(res).toMatchObject({ collected: 3, linked: 4 })
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
