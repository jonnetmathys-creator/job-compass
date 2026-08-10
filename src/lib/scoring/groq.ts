import { requireEnv } from '@/lib/env'

// Groq : API gratuite compatible OpenAI, limites bien plus hautes que le palier
// gratuit Gemini. Utilisé pour le scoring (gros volume). Modèle surchargeable via env.
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'

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
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireEnv('GROQ_API_KEY')}`,
    },
    body: JSON.stringify(body),
  })
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
