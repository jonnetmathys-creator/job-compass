import type { SupabaseClient } from '@supabase/supabase-js'
import { appelerGeminiJson } from '@/lib/candidature/gemini'
import { getProfil } from '@/lib/profil'
import { setRelanceEmail } from './lecture'

export type RelanceContenu = { objet: string; corps: string }

export const RELANCE_SCHEMA = {
  type: 'OBJECT',
  properties: { objet: { type: 'STRING' }, corps: { type: 'STRING' } },
  required: ['objet', 'corps'],
}

export function buildPromptRelance(
  offre: { titre: string; entreprise: string | null; ville: string | null },
  profil: { nom: string | null },
  emailInitial: string | null,
): string {
  return [
    "Tu es un assistant de candidature. Rédige un email de RELANCE court, poli et professionnel",
    "pour une candidature déjà envoyée et restée sans réponse.",
    '',
    'OFFRE :',
    `- Intitulé : ${offre.titre}`,
    `- Employeur : ${offre.entreprise ?? 'non précisé'}`,
    `- Ville : ${offre.ville ?? 'non précisée'}`,
    '',
    `CANDIDAT : ${profil.nom ?? 'non précisé'}`,
    '',
    emailInitial ? `EMAIL INITIAL ENVOYÉ :\n${emailInitial}` : 'Aucun email initial disponible.',
    '',
    'CONSIGNES :',
    "- Rappelle brièvement la candidature et l'intérêt pour le poste, sans insister.",
    "- Ton courtois, positif, concis (5 phrases maximum).",
    "- En français. N'invente aucun fait.",
    '- Réponds STRICTEMENT en JSON : { objet, corps }.',
  ].join('\n')
}

export async function genererRelanceCore(deps: {
  client: SupabaseClient
  userId: string
  offreId: string
  appelerImpl?: typeof appelerGeminiJson
}): Promise<RelanceContenu> {
  const { client, userId, offreId } = deps
  const appeler = deps.appelerImpl ?? appelerGeminiJson

  const { data: cand, error } = await client
    .from('candidatures')
    .select('email_corps, offres:offre_id (titre, entreprise, ville)')
    .eq('user_id', userId)
    .eq('offre_id', offreId)
    .single()
  if (error || !cand) throw new Error('Candidature introuvable')
  const offre = (Array.isArray(cand.offres) ? cand.offres[0] : cand.offres) as { titre: string; entreprise: string | null; ville: string | null }
  const profil = await getProfil(client, userId)

  const prompt = buildPromptRelance(offre, { nom: profil?.nom ?? null }, cand.email_corps ?? null)
  const contenu = await appeler(prompt, RELANCE_SCHEMA) as RelanceContenu
  // Validation minimale avant persistance : Gemini peut renvoyer un JSON
  // incomplet ou mal formé malgré le schéma demandé.
  if (typeof contenu?.objet !== 'string' || !contenu.objet.trim() || typeof contenu?.corps !== 'string' || !contenu.corps.trim()) {
    throw new Error('Réponse Gemini malformée')
  }
  await setRelanceEmail(client, userId, offreId, contenu)
  return contenu
}
