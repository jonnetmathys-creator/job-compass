import { expect, test, vi } from 'vitest'
import { buildEmailHtml, envoyerAlerte } from './email'

test('buildEmailHtml contient l\'intitulé et les offres', () => {
  const html = buildEmailHtml('Diététicien', [
    { id: 'o1', titre: 'Diététicien H/F', entreprise: 'Clinique', ville: 'Nantes' },
  ], 'https://app.test')
  expect(html).toContain('Diététicien H/F')
  expect(html).toContain('Clinique')
  expect(html).toContain('https://app.test/offre/o1')
})

test('envoyerAlerte sans RESEND_API_KEY renvoie false sans appeler fetch', async () => {
  delete process.env.RESEND_API_KEY
  const fetchImpl = vi.fn()
  const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) } as any
  const ok = await envoyerAlerte({ to: 'a@b.c', recherche: { id: 'r1', intitule: 'Diét' }, offreIds: ['o1'] }, client, { fetchImpl: fetchImpl as any })
  expect(ok).toBe(false)
  expect(fetchImpl).not.toHaveBeenCalled()
})

test('envoyerAlerte sans destinataire renvoie false sans appeler fetch', async () => {
  process.env.RESEND_API_KEY = 'test-key'
  const fetchImpl = vi.fn()
  const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) } as any
  const ok = await envoyerAlerte({ to: null, recherche: { id: 'r1', intitule: 'Diét' }, offreIds: ['o1'] }, client, { fetchImpl: fetchImpl as any })
  expect(ok).toBe(false)
  expect(fetchImpl).not.toHaveBeenCalled()
  delete process.env.RESEND_API_KEY
})

test('envoyerAlerte poste sur Resend quand la clé est présente', async () => {
  process.env.RESEND_API_KEY = 'test-key'
  const offres = [{ id: 'o1', titre: 'Diét', entreprise: 'C', ville: 'Nantes' }]
  const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: offres, error: null }) }) }) } as any
  const fetchImpl = vi.fn().mockResolvedValue({ ok: true })
  const ok = await envoyerAlerte({ to: 'a@b.c', recherche: { id: 'r1', intitule: 'Diét' }, offreIds: ['o1'] }, client, { fetchImpl: fetchImpl as any })
  expect(ok).toBe(true)
  const [url, init] = fetchImpl.mock.calls[0]
  expect(String(url)).toContain('api.resend.com')
  expect(init.headers.Authorization).toBe('Bearer test-key')
  const body = JSON.parse(init.body)
  expect(body.to).toBe('a@b.c')
  delete process.env.RESEND_API_KEY
})
