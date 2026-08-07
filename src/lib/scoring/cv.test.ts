import { expect, test, vi } from 'vitest'
import { assurerCvTexte } from './cv'

test('renvoie le cache si présent, sans extraction', async () => {
  const client = {} as any
  const t = await assurerCvTexte(client, 'u1', { cv_texte: 'déjà là', cv_url: 'u1/cv.pdf' } as any, {
    transcrire: vi.fn(), telecharger: vi.fn(),
  })
  expect(t).toBe('déjà là')
})

test('extrait et écrit le cache si absent', async () => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq }))
  const client = { from: vi.fn(() => ({ update })) } as any
  const transcrire = vi.fn().mockResolvedValue('texte du cv')
  const telecharger = vi.fn().mockResolvedValue('base64pdf')
  const t = await assurerCvTexte(client, 'u1', { cv_texte: null, cv_url: 'u1/cv.pdf' } as any, { transcrire, telecharger })
  expect(telecharger).toHaveBeenCalled()
  expect(transcrire).toHaveBeenCalledWith('base64pdf')
  expect(update).toHaveBeenCalledWith({ cv_texte: 'texte du cv' })
  expect(t).toBe('texte du cv')
})

test('renvoie null sans CV', async () => {
  const t = await assurerCvTexte({} as any, 'u1', { cv_texte: null, cv_url: null } as any, {
    transcrire: vi.fn(), telecharger: vi.fn(),
  })
  expect(t).toBeNull()
})
