import { expect, test, vi } from 'vitest'
import { genererCandidatureCore } from './generation'

// Blob factice avec arrayBuffer() -> pour le téléchargement des PDF.
function fakeBlob(bytes: number[]) {
  return { arrayBuffer: async () => new Uint8Array(bytes).buffer }
}

function makeClient(profil: any) {
  const download = vi.fn().mockResolvedValue({ data: fakeBlob([1, 2, 3]), error: null })
  const offreSingle = vi.fn().mockResolvedValue({
    data: { titre: 'Diét', entreprise: 'C', ville: 'Nantes', contrat: 'CDI', description: 'd' }, error: null,
  })
  const candSingle = vi.fn().mockResolvedValue({
    data: { user_id: 'u1', offre_id: 'o1', email_objet: 'O', email_corps: 'C', lettre: 'L', statut: 'brouillon' }, error: null,
  })
  const client: any = {
    storage: { from: vi.fn(() => ({ download })) },
    from: vi.fn((table: string) => {
      if (table === 'profils') return { select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: profil, error: null }) }) }) }
      if (table === 'offres') return { select: () => ({ eq: () => ({ single: offreSingle }) }) }
      if (table === 'candidatures') return { upsert: () => ({ select: () => ({ single: candSingle }) }) }
      throw new Error('table inattendue ' + table)
    }),
  }
  return { client, download }
}

test('profil complet : appelle Gemini avec deux PDF et upsert le résultat', async () => {
  const profil = { user_id: 'u1', nom: 'Jean', titre_recherche: 'Diét', cv_url: 'u1/cv.pdf', lettre_url: 'u1/lettre.pdf', lettre_base: null }
  const { client, download } = makeClient(profil)
  const appelerGeminiImpl = vi.fn().mockResolvedValue({ email_objet: 'O', email_corps: 'C', lettre: 'L' })

  const out = await genererCandidatureCore({ client, userId: 'u1', offreId: 'o1', appelerGeminiImpl })

  expect(download).toHaveBeenCalledTimes(2)
  expect(appelerGeminiImpl).toHaveBeenCalledTimes(1)
  const arg = appelerGeminiImpl.mock.calls[0][0]
  expect(typeof arg.cvBase64).toBe('string')
  expect(typeof arg.lettreBase64).toBe('string')
  expect(out).toMatchObject({ email_objet: 'O', lettre: 'L' })
})

test('profil incomplet (CV manquant) : lève une erreur, pas d\'appel Gemini', async () => {
  const profil = { user_id: 'u1', nom: 'Jean', titre_recherche: 'Diét', cv_url: null, lettre_url: 'u1/lettre.pdf', lettre_base: null }
  const { client } = makeClient(profil)
  const appelerGeminiImpl = vi.fn()
  await expect(genererCandidatureCore({ client, userId: 'u1', offreId: 'o1', appelerGeminiImpl })).rejects.toThrow(/incomplet/i)
  expect(appelerGeminiImpl).not.toHaveBeenCalled()
})

test('profil incomplet (lettre manquante) : lève une erreur', async () => {
  const profil = { user_id: 'u1', nom: 'Jean', titre_recherche: 'Diét', cv_url: 'u1/cv.pdf', lettre_url: null, lettre_base: null }
  const { client } = makeClient(profil)
  const appelerGeminiImpl = vi.fn()
  await expect(genererCandidatureCore({ client, userId: 'u1', offreId: 'o1', appelerGeminiImpl })).rejects.toThrow(/incomplet/i)
  expect(appelerGeminiImpl).not.toHaveBeenCalled()
})
