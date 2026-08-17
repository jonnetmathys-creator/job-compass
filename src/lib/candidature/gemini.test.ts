import { expect, test, vi } from 'vitest'
process.env.GEMINI_API_KEY ??= 'test-key'
import { buildPrompt, parseReponse, appelerGemini, appelerGeminiJson } from './gemini'
import type { GeminiParams } from './types'

const offre = { titre: 'Diététicien', entreprise: 'Clinique du Parc', ville: 'Nantes', contrat: 'CDI', description: 'Suivi nutritionnel' }
const profil = { nom: 'Jean Dupont', titre_recherche: 'Diététicien' }

test('buildPrompt contient les infos offre, le profil et les consignes humain / pas d\'invention', () => {
  const p = buildPrompt(offre, profil)
  expect(p).toContain('Diététicien')
  expect(p).toContain('Clinique du Parc')
  expect(p).toContain('Nantes')
  expect(p).toContain('Jean Dupont')
  expect(p.toLowerCase()).toContain('humain')
  expect(p.toLowerCase()).toContain('inventer')
  expect(p).toContain('email_objet')
})

test('parseReponse valide un JSON conforme', () => {
  const out = parseReponse('{"email_objet":"O","email_corps":"C","lettre":"L"}')
  expect(out).toEqual({ email_objet: 'O', email_corps: 'C', lettre: 'L' })
})

test('parseReponse rejette un JSON malformé', () => {
  expect(() => parseReponse('pas du json')).toThrow(/malform/i)
})

test('parseReponse rejette un champ manquant ou vide', () => {
  expect(() => parseReponse('{"email_objet":"O","email_corps":"C"}')).toThrow(/malform/i)
  expect(() => parseReponse('{"email_objet":"","email_corps":"C","lettre":"L"}')).toThrow(/malform/i)
})

test('appelerGemini poste sur l\'endpoint avec deux PDF inline et le schéma JSON', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: '{"email_objet":"O","email_corps":"C","lettre":"L"}' }] } }],
    }),
  })
  const params: GeminiParams = { offre, profil, cvBase64: 'CV_B64', lettreBase64: 'LET_B64' }

  const out = await appelerGemini(params, { fetchImpl: fetchImpl as any })

  expect(out).toEqual({ email_objet: 'O', email_corps: 'C', lettre: 'L' })
  const [url, init] = fetchImpl.mock.calls[0]
  expect(String(url)).toContain('gemini-flash-latest')
  expect(init.method).toBe('POST')
  const body = JSON.parse(init.body)
  const parts = body.contents[0].parts
  const pdfs = parts.filter((p: any) => p.inline_data?.mime_type === 'application/pdf')
  expect(pdfs.map((p: any) => p.inline_data.data)).toEqual(['CV_B64', 'LET_B64'])
  expect(body.generationConfig.response_mime_type).toBe('application/json')
  expect(body.generationConfig.response_schema.required).toEqual(
    expect.arrayContaining(['email_objet', 'email_corps', 'lettre']),
  )
})

test('appelerGemini lève une erreur claire après épuisement des reprises (HTTP non ok)', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'quota' })
  const params: GeminiParams = { offre, profil, cvBase64: 'A', lettreBase64: 'B' }
  // pauses: [] -> pas d'attente entre les tentatives (test rapide)
  await expect(appelerGemini(params, { fetchImpl: fetchImpl as any, pauses: [] })).rejects.toThrow(/Gemini/i)
  expect(fetchImpl).toHaveBeenCalledTimes(5) // 3 essais modèle principal + 2 repli
})

test('appelerGemini bascule sur le modèle de repli après un 503 transitoire', async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'overloaded' })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"email_objet":"O","email_corps":"C","lettre":"L"}' }] } }] }) })
  const params: GeminiParams = { offre, profil, cvBase64: 'A', lettreBase64: 'B' }
  const out = await appelerGemini(params, { fetchImpl: fetchImpl as any, pauses: [] })
  expect(out).toEqual({ email_objet: 'O', email_corps: 'C', lettre: 'L' })
  expect(fetchImpl).toHaveBeenCalledTimes(2)
})

test('appelerGeminiJson poste le prompt + schéma et parse le JSON', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"objet":"O","corps":"C"}' }] } }] }),
  })
  const schema = { type: 'OBJECT', properties: { objet: { type: 'STRING' }, corps: { type: 'STRING' } }, required: ['objet', 'corps'] }
  const out = await appelerGeminiJson<{ objet: string; corps: string }>('un prompt', schema, { fetchImpl: fetchImpl as any })

  expect(out).toEqual({ objet: 'O', corps: 'C' })
  const [url, init] = fetchImpl.mock.calls[0]
  expect(String(url)).toContain('gemini-flash-latest')
  const body = JSON.parse(init.body)
  expect(body.contents[0].parts[0].text).toBe('un prompt')
  expect(body.generationConfig.response_schema).toEqual(schema)
})
