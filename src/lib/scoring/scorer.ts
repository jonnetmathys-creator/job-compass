import { appelerGroqJson } from './groq'

export type OffreANoter = {
  ref: string; titre: string; entreprise: string | null; ville: string | null
  contrat: string | null; description: string | null
}
export type Note = { ref: string; score: number; raison: string }

const TAILLE_LOT = 20

export function construirePromptScoring(cvTexte: string, offres: OffreANoter[]): string {
  const lignes = offres.map((o) =>
    `- ref ${o.ref} | ${o.titre} | ${o.entreprise ?? '?'} | ${o.ville ?? '?'} | ${o.contrat ?? '?'} | ${(o.description ?? '').slice(0, 400)}`)
  return [
    "Tu es un conseiller en recrutement spécialisé en diététique.",
    "Voici le CV d'un candidat, puis une liste d'offres.",
    "Pour CHAQUE offre, donne un score de 0 à 100 mesurant l'adéquation entre le profil du CV et l'offre,",
    "et une raison en une phrase courte qui s'adresse DIRECTEMENT à la personne en la vouvoyant",
    "(« vous », « votre »), sans jamais parler du « candidat » à la 3e personne.",
    "Exemple de ton : « Ce poste valorise votre expérience en nutrition clinique. »",
    'Réponds STRICTEMENT en JSON : un objet { "notes": [ { "ref", "score", "raison" } ] },',
    'avec une entrée par ref fournie (score entier 0-100, raison en français, au « vous »).',
    '',
    'CV :',
    cvTexte.slice(0, 6000),
    '',
    'OFFRES :',
    ...lignes,
  ].join('\n')
}

// Défaut : Groq. Le mode JSON impose un objet racine -> on demande { notes: [...] }.
async function noterViaGroq(prompt: string): Promise<Note[]> {
  const res = await appelerGroqJson<{ notes?: Note[] }>(prompt)
  return res.notes ?? []
}

type Deps = { appeler?: (prompt: string) => Promise<Note[]> }

export async function scorerOffres(cvTexte: string, offres: OffreANoter[], deps: Deps = {}): Promise<Note[]> {
  const appeler = deps.appeler ?? noterViaGroq
  const notes: Note[] = []
  for (let i = 0; i < offres.length; i += TAILLE_LOT) {
    const lot = offres.slice(i, i + TAILLE_LOT)
    try {
      const res = await appeler(construirePromptScoring(cvTexte, lot))
      notes.push(...res)
    } catch (e) {
      console.error('[scoring] lot en échec :', e)
    }
  }
  return notes
}
