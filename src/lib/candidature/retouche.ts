import { appelerGeminiJson } from './gemini'

// Retouche IA ciblée du CORPS d'une lettre (raccourcir, ton, corriger…), sans
// tout régénérer. On ne touche qu'au texte fourni et on renvoie la version
// réécrite. La consigne vient de l'UI (boutons / curseur de ton).
export function buildRetouchePrompt(texte: string, consigne: string): string {
  return [
    'Tu es un assistant de rédaction de lettres de motivation.',
    'Voici le CORPS d\'une lettre (de la formule d\'appel « Madame, Monsieur, » jusqu\'à la',
    'formule de politesse et la signature). Applique cette consigne :',
    `CONSIGNE : ${consigne}`,
    '',
    'RÈGLES :',
    "- Garde le sens et les faits : n'invente rien, ne supprime aucune information factuelle.",
    '- Conserve la structure : formule d\'appel, paragraphes, formule de politesse, signature.',
    "- N'ajoute NI bloc d'adresses (expéditeur/destinataire), NI date, NI ligne « Objet : ».",
    '- Rédige en français.',
    '- Réponds STRICTEMENT au format JSON : { lettre }.',
    '',
    'LETTRE :',
    texte,
  ].join('\n')
}

const SCHEMA = {
  type: 'OBJECT',
  properties: { lettre: { type: 'STRING' } },
  required: ['lettre'],
}

type Deps = { appelerJson?: typeof appelerGeminiJson }

export async function retoucherLettreCore(texte: string, consigne: string, deps: Deps = {}): Promise<string> {
  const appeler = deps.appelerJson ?? appelerGeminiJson
  const { lettre } = await appeler<{ lettre: string }>(buildRetouchePrompt(texte, consigne), SCHEMA)
  return lettre
}
