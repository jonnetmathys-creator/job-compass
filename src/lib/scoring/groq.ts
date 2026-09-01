import { requireEnv } from '@/lib/env'
import { fetchAvecDelai } from '@/lib/http'

// Le scoring est le plus gros volume du refresh et son seul appel réseau : sans
// borne de temps, un Groq qui pend gèle toute la collecte (cf. incident 700 s).
// Timeout généreux (une complétion de 20 offres peut être lente) mais fini.
const TIMEOUT_GROQ_MS = 60000

// Groq : API gratuite compatible OpenAI, limites bien plus hautes que le palier
// gratuit Gemini. Utilisé pour le scoring (gros volume). Modèle surchargeable via env.
// llama-3.3-70b-versatile a été retiré par Groq (404) : tous les lots de scoring
// échouaient. openai/gpt-oss-120b le remplace (dispo, mode JSON, couverture complète
// des lots de 20, raisons en français correctes).
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b'

// Appel Groq texte -> JSON. Le mode JSON d'OpenAI/Groq impose un OBJET racine
// (pas un tableau nu) : le prompt doit demander un objet, on renvoie l'objet parsé.
export async function appelerGroqJson<T>(
  prompt: string,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<T> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  }
  const res = await fetchAvecDelai(fetchImpl, ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireEnv('GROQ_API_KEY')}`,
    },
    body: JSON.stringify(body),
  }, TIMEOUT_GROQ_MS)
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Appel Groq échoué : HTTP ${res.status} ${detail}`.trim())
  }
  const json = await res.json()
  const text: string | undefined = json?.choices?.[0]?.message?.content
  if (!text) throw new Error('Appel Groq : réponse vide')
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Réponse Groq malformée')
  }
}
