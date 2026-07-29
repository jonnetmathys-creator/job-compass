import { expect, test, vi } from 'vitest'
import { buildPromptRelance, genererRelanceCore } from './relance'

test('buildPromptRelance contient employeur, nom et consigne de relance courte', () => {
  const p = buildPromptRelance({ titre: 'Diététicien', entreprise: 'Clinique', ville: 'Nantes' }, { nom: 'Jean Dupont' }, 'Bonjour, ma candidature...')
  expect(p).toContain('Clinique')
  expect(p).toContain('Jean Dupont')
  expect(p.toLowerCase()).toContain('relance')
  expect(p).toContain('objet')
})

test('genererRelanceCore appelle Gemini et enregistre le résultat', async () => {
  const updates: any[] = []
  const candSingle = vi.fn().mockResolvedValue({
    data: { email_corps: 'email initial', offres: { titre: 'Diét', entreprise: 'C', ville: 'Nantes' } }, error: null,
  })
  const client: any = {
    from: vi.fn((table: string) => {
      if (table === 'candidatures') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: candSingle }) }) }),
          update: (p: any) => { updates.push(p); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) } },
        }
      }
      if (table === 'profils') return { select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { nom: 'Jean' }, error: null }) }) }) }
      throw new Error('table inattendue ' + table)
    }),
  }
  const appelerImpl = vi.fn().mockResolvedValue({ objet: 'Relance', corps: 'Bonjour...' })

  const out = await genererRelanceCore({ client, userId: 'u1', offreId: 'o1', appelerImpl })

  expect(appelerImpl).toHaveBeenCalledTimes(1)
  expect(out).toEqual({ objet: 'Relance', corps: 'Bonjour...' })
  expect(updates.some((p) => p.relance_objet === 'Relance' && p.relance_corps === 'Bonjour...')).toBe(true)
})
