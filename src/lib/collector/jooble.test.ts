import { expect, test, beforeEach, vi } from 'vitest'
import { buildJoobleRequest, normalizeJoobleOffre, searchJooble } from './jooble'

beforeEach(() => { process.env.JOOBLE_API_KEY = 'jk123' })

test('searchJooble est inactif (retourne [] sans appeler fetch) si aucune clé', async () => {
  delete process.env.JOOBLE_API_KEY
  const mockFetch = vi.fn()
  const offres = await searchJooble(
    { motsCles: ['diététicien'], codeRome: 'J1402' },
    { fetchImpl: mockFetch as any, geocode: vi.fn() as any })
  expect(offres).toEqual([])
  expect(mockFetch).not.toHaveBeenCalled()
})

test('buildJoobleRequest cible l’API avec la clé et le corps attendu', () => {
  const { url, body } = buildJoobleRequest(
    { motsCles: [], codeRome: 'J1402', commune: 'Nantes', distance: 25 }, 'diététicien', 2)
  expect(url).toBe('https://jooble.org/api/jk123')
  expect(body).toEqual({ keywords: 'diététicien', page: '2', location: 'Nantes', radius: '25' })
})

test('buildJoobleRequest omet location et radius si absents', () => {
  const { body } = buildJoobleRequest({ motsCles: [], codeRome: 'J1402' }, 'nutrition', 1)
  expect(body).toEqual({ keywords: 'nutrition', page: '1' })
})

test('normalizeJoobleOffre mappe les champs, nettoie le HTML et pose source jooble', () => {
  const raw = {
    id: 123456,
    title: 'Diététicien H/F',
    company: 'EHPAD Les Tilleuls',
    snippet: 'Poste en <b>CDI</b> à pourvoir',
    type: 'CDI',
    salary: '2000 - 2300 EUR',
    location: 'Nantes',
    link: 'https://jooble.org/jdp/123456',
    updated: '2026-07-30T08:00:00Z',
  }
  const o = normalizeJoobleOffre(raw)
  expect(o.source).toBe('jooble')
  expect(o.source_id).toBe('123456')
  expect(o.titre).toBe('Diététicien H/F')
  expect(o.entreprise).toBe('EHPAD Les Tilleuls')
  expect(o.description).toBe('Poste en CDI à pourvoir')
  expect(o.contrat).toBe('CDI')
  expect(o.salaire).toBe('2000 - 2300 EUR')
  expect(o.ville).toBe('Nantes')
  expect(o.url_postuler).toBe('https://jooble.org/jdp/123456')
  expect(o.latitude).toBeNull()
  expect(o.email_contact).toBeNull()
  expect(o.date_publication).toBe('2026-07-30T08:00:00Z')
})

test('normalizeJoobleOffre met à null les champs manquants', () => {
  const o = normalizeJoobleOffre({ id: 7, title: 'X' })
  expect(o.entreprise).toBeNull()
  expect(o.salaire).toBeNull()
  expect(o.contrat).toBeNull()
  expect(o.description).toBeNull()
})

test('searchJooble pagine puis s’arrête sur une page vide', async () => {
  let calls = 0
  const mockFetch = vi.fn(async () => {
    calls++
    const jobs = calls <= 2
      ? Array.from({ length: 3 }, (_, i) => ({ id: `p${calls}-${i}`, title: 'Diététicien', location: 'Nantes' }))
      : []
    return new Response(JSON.stringify({ jobs }), { status: 200 })
  })
  const geocode = vi.fn(async () => ({ insee: '44109', lat: 47.2, lng: -1.55, label: 'Nantes' }))
  const offres = await searchJooble(
    { motsCles: ['diét'], codeRome: 'J1402' },
    { fetchImpl: mockFetch as any, geocode: geocode as any })
  expect(offres).toHaveLength(6) // 2 pages x 3 offres
  expect(mockFetch).toHaveBeenCalledTimes(3) // la 3e page vide arrête la boucle
  expect(offres.every((o) => o.source === 'jooble')).toBe(true)
})

test('searchJooble s’arrête sans exception si la réponse n’est pas ok', async () => {
  const mockFetch = vi.fn(async () => new Response('nope', { status: 500 }))
  const offres = await searchJooble(
    { motsCles: ['x'], codeRome: 'J1402' },
    { fetchImpl: mockFetch as any, geocode: vi.fn() as any })
  expect(offres).toHaveLength(0)
})

test('searchJooble géocode chaque ville distincte une seule fois', async () => {
  const jobs = [
    { id: '1', title: 'Diététicien A', location: 'Nantes' },
    { id: '2', title: 'Diététicien B', location: 'Nantes' },
    { id: '3', title: 'Diététicien C', location: 'Rennes' },
  ]
  let page = 0
  const mockFetch = vi.fn(async () => {
    page++
    return new Response(JSON.stringify({ jobs: page === 1 ? jobs : [] }), { status: 200 })
  })
  const geocode = vi.fn(async (ville: string) =>
    ville === 'Nantes' ? { insee: '44109', lat: 47.2, lng: -1.55, label: 'Nantes' } : null)
  const offres = await searchJooble(
    { motsCles: ['x'], codeRome: 'J1402' },
    { fetchImpl: mockFetch as any, geocode: geocode as any })
  expect(geocode).toHaveBeenCalledTimes(2) // Nantes + Rennes, pas 3 fois
  expect(offres.filter((o) => o.ville === 'Nantes').every((o) => o.latitude === 47.2 && o.longitude === -1.55)).toBe(true)
  expect(offres.find((o) => o.ville === 'Rennes')!.latitude).toBeNull() // ville non résolue
})
