import { appelerGeminiJson } from '@/lib/candidature/gemini'

export type OffreANoter = {
  ref: string; titre: string; entreprise: string | null; ville: string | null
  contrat: string | null; description: string | null
}
export type Note = { ref: string; score: number; raison: string }

const TAILLE_LOT = 20

const SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: { ref: { type: 'STRING' }, score: { type: 'INTEGER' }, raison: { type: 'STRING' } },
    required: ['ref', 'score', 'raison'],
  },
}

export function construirePromptScoring(cvTexte: string, offres: OffreANoter[]): string {
  const lignes = offres.map((o) =>
    `- ref ${o.ref} | ${o.titre} | ${o.entreprise ?? '?'} | ${o.ville ?? '?'} | ${o.contrat ?? '?'} | ${(o.description ?? '').slice(0, 400)}`)
  return [
    "Tu es un conseiller en recrutement spécialisé en diététique.",
    "Voici le CV d'un candidat, puis une liste d'offres.",
    "Pour CHAQUE offre, donne un score de 0 à 100 mesurant l'adéquation entre le profil du CV et l'offre,",
    "et une raison en une phrase courte (en français).",
    'Réponds STRICTEMENT en JSON : un tableau [{ ref, score, raison }], une entrée par ref fournie.',
    '',
    'CV :',
    cvTexte.slice(0, 6000),
    '',
    'OFFRES :',
    ...lignes,
  ].join('\n')
}

type Deps = { appeler?: typeof appelerGeminiJson }

export async function scorerOffres(cvTexte: string, offres: OffreANoter[], deps: Deps = {}): Promise<Note[]> {
  const appeler = deps.appeler ?? appelerGeminiJson
  const notes: Note[] = []
  for (let i = 0; i < offres.length; i += TAILLE_LOT) {
    const lot = offres.slice(i, i + TAILLE_LOT)
    try {
      const res = await appeler<Note[]>(construirePromptScoring(cvTexte, lot), SCHEMA)
      notes.push(...res)
    } catch (e) {
      console.error('[scoring] lot en échec :', e)
    }
  }
  return notes
}
