import { requireEnv } from '@/lib/env'
import type { OffreInfo, ProfilInfo, GeminiParams, CandidatureContenu } from './types'

// gemini-flash-latest est régulièrement surchargé : il ne renvoie même plus de
// 503, il « pend » (aucune réponse), ce qui bloquait toute la requête candidature
// jusqu'au timeout de la route. gemini-flash-lite-latest est stable, rapide et
// gère le multimodal (PDF) + response_schema. On en fait donc le modèle principal,
// avec flash-latest en dernier recours seulement, et surtout un TIMEOUT par
// tentative pour qu'un modèle qui pend ne bloque plus jamais l'ensemble.
const MODEL = 'gemini-flash-lite-latest'
const MODEL_REPLI = 'gemini-flash-latest'
const PAUSES_DEFAUT = [400, 800] // ms avant les tentatives 2..3
const TIMEOUT_DEFAUT = 30000 // ms max par tentative (borne un modèle qui pend)
const TRANSITOIRE = new Set([429, 500, 502, 503, 504])

function endpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

type GenDeps = { fetchImpl?: typeof fetch; pauses?: number[]; timeoutMs?: number }

// Envoie une requête generateContent avec reprises + modèle de repli, et renvoie
// le texte de la réponse. Chaque tentative est bornée par un timeout ; on réessaie
// sur timeout, erreur réseau et erreurs HTTP transitoires.
async function genererTexte(body: unknown, deps: GenDeps = {}): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const pauses = deps.pauses ?? PAUSES_DEFAUT
  const timeoutMs = deps.timeoutMs ?? TIMEOUT_DEFAUT
  const modeles = [MODEL, MODEL, MODEL_REPLI]
  let dernier = 'erreur inconnue'
  for (let i = 0; i < modeles.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, pauses[i - 1] ?? 0))
    const ctrl = new AbortController()
    const minuteur = setTimeout(() => ctrl.abort(), timeoutMs)
    let res: Response
    try {
      res = await fetchImpl(endpoint(modeles[i]), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': requireEnv('GEMINI_API_KEY') },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
    } catch (e) {
      dernier = (e as Error).name === 'AbortError' ? `délai dépassé (${timeoutMs} ms)` : `réseau : ${(e as Error).message}`
      continue
    } finally {
      clearTimeout(minuteur)
    }
    if (res.ok) {
      const json = await res.json()
      const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return text
      dernier = 'réponse vide'
      continue
    }
    const detail = await res.text().catch(() => '')
    dernier = `HTTP ${res.status} ${detail}`.trim().slice(0, 300)
    if (!TRANSITOIRE.has(res.status)) break // 400/401/403 : inutile de réessayer
  }
  throw new Error(`Appel Gemini échoué : ${dernier}`)
}

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

export async function appelerGemini(params: GeminiParams, deps: GenDeps = {}): Promise<CandidatureContenu> {
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
  const text = await genererTexte(body, deps)
  return parseReponse(text)
}

// Transcrit un PDF (base64) en texte brut via Gemini. Usage : mise en cache du CV.
export async function transcrirePdf(base64: string, deps: GenDeps = {}): Promise<string> {
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: 'Transcris intégralement ce document en texte brut, sans commentaire ni mise en forme.' },
        { inline_data: { mime_type: 'application/pdf', data: base64 } },
      ],
    }],
  }
  return genererTexte(body, deps)
}

// Appel Gemini générique texte -> JSON structuré (sans PDF), pour des usages
// hors candidature complète (ex. mail de relance).
export async function appelerGeminiJson<T>(prompt: string, schema: object, deps: GenDeps = {}): Promise<T> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { response_mime_type: 'application/json', response_schema: schema },
  }
  const text = await genererTexte(body, deps)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Réponse Gemini malformée')
  }
}
