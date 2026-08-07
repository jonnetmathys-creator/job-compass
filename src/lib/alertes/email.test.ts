import { expect, test, vi } from 'vitest'
import { buildEmailHtml, bandeauTopMatch, envoyerAlerte } from './email'

const sansScore = async () => new Map()

test('buildEmailHtml contient l\'intitulé et les offres', () => {
  const html = buildEmailHtml('Diététicien', [
    { id: 'o1', titre: 'Diététicien H/F', entreprise: 'Clinique', ville: 'Nantes' },
  ], 'https://app.test')
  expect(html).toContain('Diététicien H/F')
  expect(html).toContain('Clinique')
  expect(html).toContain('https://app.test/offre/o1')
})

test('bandeauTopMatch détecte une offre ≥ 90 et renvoie le max', () => {
  expect(bandeauTopMatch([{ score: 60 }, { score: 94 }])).toEqual({ top: true, maxScore: 94 })
  expect(bandeauTopMatch([{ score: 60 }, { score: 80 }])).toEqual({ top: false, maxScore: 80 })
  expect(bandeauTopMatch([{}, {}])).toEqual({ top: false, maxScore: 0 })
})

test('buildEmailHtml trie par score et ajoute le bandeau si ≥ 90', () => {
  const html = buildEmailHtml('Diét', [
    { id: 'bas', titre: 'Bas', entreprise: null, ville: null, score: 40 },
    { id: 'top', titre: 'Top', entreprise: null, ville: null, score: 92 },
  ], 'https://app.test')
  expect(html).toContain('correspond à 92% à ton profil')
  expect(html).toContain('92%')
  // l'offre top (92) apparaît avant l'offre basse (40)
  expect(html.indexOf('/offre/top')).toBeLessThan(html.indexOf('/offre/bas'))
})

test('envoyerAlerte sans compte Gmail configuré renvoie false sans envoyer', async () => {
  delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD
  const envoi = vi.fn((..._args: unknown[]) => Promise.resolve(true))
  const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) } as never
  const ok = await envoyerAlerte({ to: 'a@b.c', recherche: { id: 'r1', intitule: 'Diét' }, offreIds: ['o1'] }, client, { envoi, getScores: sansScore })
  expect(ok).toBe(false)
  expect(envoi).not.toHaveBeenCalled()
})

test('envoyerAlerte envoie via SMTP et enrichit le sujet si top match', async () => {
  process.env.GMAIL_USER = 'jc@gmail.com'; process.env.GMAIL_APP_PASSWORD = 'app-pass'
  const offres = [{ id: 'o1', titre: 'Diét', entreprise: 'C', ville: 'Nantes' }]
  const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: offres, error: null }) }) }) } as never
  const envoi = vi.fn((..._args: unknown[]) => Promise.resolve(true))
  const getScores = async () => new Map([['o1', { score: 93, raison: 'fort' }]])
  const ok = await envoyerAlerte({ to: 'a@b.c', recherche: { id: 'r1', intitule: 'Diét', user_id: 'u1' }, offreIds: ['o1'] }, client, { envoi, getScores })
  expect(ok).toBe(true)
  const msg = envoi.mock.calls[0][0] as { subject: string; html: string }
  expect(msg.subject).toContain('Top match (93%)')
  expect(msg.html).toContain('93%')
  delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD
})
