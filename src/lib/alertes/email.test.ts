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

test('envoyerAlerte sans compte Gmail configuré renvoie false sans envoyer', async () => {
  delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD
  const envoi = vi.fn((..._args: unknown[]) => Promise.resolve(true))
  const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) } as never
  const ok = await envoyerAlerte({ to: 'a@b.c', recherche: { id: 'r1', intitule: 'Diét' }, offreIds: ['o1'] }, client, { envoi })
  expect(ok).toBe(false)
  expect(envoi).not.toHaveBeenCalled()
})

test('envoyerAlerte sans destinataire renvoie false sans envoyer', async () => {
  process.env.GMAIL_USER = 'jc@gmail.com'; process.env.GMAIL_APP_PASSWORD = 'app-pass'
  const envoi = vi.fn((..._args: unknown[]) => Promise.resolve(true))
  const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) } as never
  const ok = await envoyerAlerte({ to: null, recherche: { id: 'r1', intitule: 'Diét' }, offreIds: ['o1'] }, client, { envoi })
  expect(ok).toBe(false)
  expect(envoi).not.toHaveBeenCalled()
  delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD
})

test('envoyerAlerte envoie via SMTP quand Gmail est configuré', async () => {
  process.env.GMAIL_USER = 'jc@gmail.com'; process.env.GMAIL_APP_PASSWORD = 'app-pass'
  const offres = [{ id: 'o1', titre: 'Diét', entreprise: 'C', ville: 'Nantes' }]
  const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: offres, error: null }) }) }) } as never
  const envoi = vi.fn((..._args: unknown[]) => Promise.resolve(true))
  const ok = await envoyerAlerte({ to: 'a@b.c', recherche: { id: 'r1', intitule: 'Diét' }, offreIds: ['o1'] }, client, { envoi })
  expect(ok).toBe(true)
  const msg = envoi.mock.calls[0][0] as { to: string; from: string; subject: string; html: string }
  expect(msg.to).toBe('a@b.c')
  expect(msg.from).toContain('jc@gmail.com')
  expect(msg.subject).toContain('Diét')
  expect(msg.html).toContain('Diét')
  delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD
})
