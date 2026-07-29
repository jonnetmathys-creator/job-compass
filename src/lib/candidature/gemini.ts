import { requireEnv } from '@/lib/env'
import type { OffreInfo, ProfilInfo, GeminiParams, CandidatureContenu } from './types'

// gemini-flash-latest : seul modèle flash avec du quota gratuit sur notre clé
// (gemini-2.0-flash renvoie limit=0 en free tier). Alias suivi par Google.
const MODEL = 'gemini-flash-latest'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export function buildPrompt(offre: OffreInfo, profil: ProfilInfo): string {
  return [
    "Tu es un assistant de candidature pour un professionnel de la diététique.",
    "À partir du CV et de la lettre de motivation de base fournis en pièces jointes (PDF),",
    "rédige un email de candidature et une lettre de motivation personnalisés pour l'offre ci-dessous.",
    '',
    'OFFRE :',
    `- Intitulé : ${offre.titre}`,
    `- Employeur : ${offre.entreprise ?? 'non précisé'}`,
    `- Ville : ${offre.ville ?? 'non précisée'}`,
    `- Contrat : ${offre.contrat ?? 'non précisé'}`,
    `- Description : ${offre.description ?? 'non fournie'}`,
    '',
    'CANDIDAT :',
    `- Nom : ${profil.nom ?? 'non précisé'}`,
    `- Poste recherché : ${profil.titre_recherche ?? 'non précisé'}`,
    '',
    'CONSIGNES :',
    "- Email court et professionnel (objet + corps) accompagnant la candidature.",
    "- Lettre de motivation structurée, personnalisée à l'offre (employeur, missions, ville),",
    "  appuyée sur le CV (parcours, expériences, diplômes) et reprenant l'esprit et le ton de la lettre de base.",
    "- Ton naturel et humain, sobre, sans tournures robotiques ni formules génériques creuses.",
    "- Interdiction d'inventer un fait absent du CV ou de la lettre de base.",
    "- Rédige en français.",
    '- Réponds STRICTEMENT au format JSON : { email_objet, email_corps, lettre }.',
  ].join('\n')
}

export function parseReponse(text: string): CandidatureContenu {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error('Réponse Gemini malformée')
  }
  const o = obj as Record<string, unknown>
  const champs = ['email_objet', 'email_corps', 'lettre'] as const
  for (const c of champs) {
    if (typeof o[c] !== 'string' || (o[c] as string).trim() === '') {
      throw new Error('Réponse Gemini malformée')
    }
  }
  return { email_objet: o.email_objet as string, email_corps: o.email_corps as string, lettre: o.lettre as string }
}

export async function appelerGemini(
  params: GeminiParams,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<CandidatureContenu> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildPrompt(params.offre, params.profil) },
          { inline_data: { mime_type: 'application/pdf', data: params.cvBase64 } },
          { inline_data: { mime_type: 'application/pdf', data: params.lettreBase64 } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: {
        type: 'OBJECT',
        properties: {
          email_objet: { type: 'STRING' },
          email_corps: { type: 'STRING' },
          lettre: { type: 'STRING' },
        },
        required: ['email_objet', 'email_corps', 'lettre'],
      },
    },
  }
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': requireEnv('GEMINI_API_KEY'),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Appel Gemini échoué : HTTP ${res.status} ${detail}`.trim())
  }
  const json = await res.json()
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Appel Gemini : réponse vide')
  return parseReponse(text)
}
