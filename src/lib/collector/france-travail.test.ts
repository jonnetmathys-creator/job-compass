import { expect, test, vi } from 'vitest'
import { buildFtQuery, normalizeFtOffre, searchFranceTravail } from './france-travail'

test('buildFtQuery inclut mot-clé, code ROME, commune, distance, contrat', () => {
  const q = buildFtQuery(
    { motsCles: [], codeRome: 'J1402', commune: '44109', distance: 30, typeContrat: 'CDI' },
    'diététicien',
  )
  expect(q).toContain('motsCles=di%C3%A9t%C3%A9ticien')
  expect(q).toContain('codeROME=J1402')
  expect(q).toContain('commune=44109')
  expect(q).toContain('distance=30')
  expect(q).toContain('typeContrat=CDI')
})

test('normalizeFtOffre mappe les champs et pose source france_travail', () => {
  const raw = {
    id: 'FT123',
    intitule: 'Diététicien(ne) en EHPAD',
    entreprise: { nom: 'Les Tilleuls' },
    description: 'Poste...',
    typeContratLibelle: 'CDI',
    salaire: { libelle: '2100 EUR' },
    lieuTravail: { latitude: 47.2, longitude: -1.5, libelle: 'Nantes' },
    origineOffre: { urlOrigine: 'https://candidat.francetravail.fr/offres/FT123' },
    dateCreation: '2026-07-20T10:00:00.000Z',
    contact: { courriel: 'rh@tilleuls.fr' },
  }
  const o = normalizeFtOffre(raw)
  expect(o.source).toBe('france_travail')
  expect(o.source_id).toBe('FT123')
  expect(o.titre).toBe('Diététicien(ne) en EHPAD')
  expect(o.entreprise).toBe('Les Tilleuls')
  expect(o.contrat).toBe('CDI')
  expect(o.salaire).toBe('2100 EUR')
  expect(o.latitude).toBe(47.2)
  expect(o.longitude).toBe(-1.5)
  expect(o.ville).toBe('Nantes')
  expect(o.url_postuler).toContain('FT123')
  expect(o.email_contact).toBe('rh@tilleuls.fr')
  expect(o.date_publication).toBe('2026-07-20T10:00:00.000Z')
})

test('normalizeFtOffre tolère les champs manquants', () => {
  const o = normalizeFtOffre({ id: 'X', intitule: 'T' })
  expect(o.entreprise).toBeNull()
  expect(o.latitude).toBeNull()
  expect(o.email_contact).toBeNull()
})

test('normalizeFtOffre capte le logo entreprise quand présent', () => {
  const o = normalizeFtOffre({ id: '1', intitule: 'X', entreprise: { nom: 'ACME', logo: 'https://x/logo.png' } })
  expect(o.entreprise_logo).toBe('https://x/logo.png')
})

test('normalizeFtOffre met entreprise_logo à null si absent', () => {
  const o = normalizeFtOffre({ id: '2', intitule: 'Y', entreprise: { nom: 'ACME' } })
  expect(o.entreprise_logo).toBeNull()
})

test('searchFranceTravail plafonne à 300 offres au total, même avec plusieurs mots-clés qui débordent chacun', async () => {
  let counter = 0
  const fetchImpl = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      resultats: Array.from({ length: 150 }, () => {
        counter += 1
        return { id: `FT${counter}`, intitule: 'Diététicien' }
      }),
    }),
  })) as unknown as typeof fetch

  const offres = await searchFranceTravail(
    { motsCles: ['diététicien', 'nutritionniste', 'diet'], codeRome: 'J1402' },
    { token: 'tok', fetchImpl },
  )
  expect(offres.length).toBeLessThanOrEqual(300)
})
