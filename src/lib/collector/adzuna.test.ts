import { expect, test, beforeEach } from 'vitest'
import { buildAdzunaUrl, normalizeAdzunaOffre, searchAdzuna } from './adzuna'

beforeEach(() => {
  process.env.ADZUNA_APP_ID = 'id123'
  process.env.ADZUNA_APP_KEY = 'key123'
})

test('buildAdzunaUrl vise la France et inclut le mot-clé + identifiants', () => {
  const url = buildAdzunaUrl({ motsCles: [], codeRome: 'J1402' }, 'diététicien', 1)
  expect(url).toContain('/jobs/fr/search/1')
  expect(url).toContain('app_id=id123')
  expect(url).toContain('app_key=key123')
  expect(url).toContain('what=di%C3%A9t%C3%A9ticien')
})

test('normalizeAdzunaOffre mappe les champs et pose source adzuna', () => {
  const raw = {
    id: 'AZ789',
    title: 'Diététicien libéral',
    company: { display_name: 'Clinique du Parc' },
    description: 'Vacations...',
    contract_time: 'part_time',
    salary_min: 24000,
    salary_max: 28000,
    latitude: 47.2,
    longitude: -1.6,
    location: { display_name: 'Saint-Herblain' },
    redirect_url: 'https://www.adzuna.fr/jobs/land/ad/AZ789',
    created: '2026-07-21T09:00:00Z',
  }
  const o = normalizeAdzunaOffre(raw)
  expect(o.source).toBe('adzuna')
  expect(o.source_id).toBe('AZ789')
  expect(o.titre).toBe('Diététicien libéral')
  expect(o.entreprise).toBe('Clinique du Parc')
  expect(o.contrat).toBe('part_time')
  expect(o.salaire).toBe('24000 - 28000')
  expect(o.ville).toBe('Saint-Herblain')
  expect(o.url_postuler).toContain('AZ789')
  expect(o.email_contact).toBeNull() // Adzuna n'expose pas d'email
  expect(o.date_publication).toBe('2026-07-21T09:00:00Z')
})

test('searchAdzuna applique un plafond strict de 300 offres', async () => {
  let pageCount = 0
  const mockFetch = async (url: string) => {
    pageCount++
    // Return 50 unique offers per page (simulating full pages)
    const results = Array.from({ length: 50 }, (_, i) => ({
      id: `AZ${pageCount}-${i}`,
      title: `Job ${pageCount}-${i}`,
      company: { display_name: 'Company' },
      description: 'Desc',
      contract_time: 'full_time',
      salary_min: 30000,
      salary_max: 40000,
      latitude: 48,
      longitude: 2,
      location: { display_name: 'Paris' },
      redirect_url: `https://adzuna.fr/${pageCount}-${i}`,
      created: '2026-07-21T09:00:00Z',
    }))
    return new Response(JSON.stringify({ results }), { status: 200 })
  }

  const offers = await searchAdzuna(
    { motsCles: ['test'], codeRome: 'J1402' },
    { fetchImpl: mockFetch as any }
  )

  expect(offers.length).toBeLessThanOrEqual(300)
  expect(offers.length).toBe(300)
  expect(offers.every(o => o.source === 'adzuna')).toBe(true)
})
