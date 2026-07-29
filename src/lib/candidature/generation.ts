import type { SupabaseClient } from '@supabase/supabase-js'
import { getProfil } from '@/lib/profil'
import { appelerGemini } from './gemini'
import { upsertCandidature } from './lecture'
import type { Candidature, OffreInfo } from './types'

async function blobToBase64(blob: { arrayBuffer: () => Promise<ArrayBuffer> }): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer())
  return buf.toString('base64')
}

async function telechargerPdf(client: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await client.storage.from('cv').download(path)
  if (error || !data) throw new Error(`PDF illisible : ${path}`)
  return blobToBase64(data as unknown as { arrayBuffer: () => Promise<ArrayBuffer> })
}

export async function genererCandidatureCore(deps: {
  client: SupabaseClient
  userId: string
  offreId: string
  appelerGeminiImpl?: typeof appelerGemini
}): Promise<Candidature> {
  const { client, userId, offreId } = deps
  const appeler = deps.appelerGeminiImpl ?? appelerGemini

  const profil = await getProfil(client, userId)
  if (!profil?.cv_url || !profil?.lettre_url) {
    throw new Error('Profil incomplet : ajoute ton CV et ta lettre de base (PDF) avant de générer.')
  }

  const { data: offre, error: offreErr } = await client
    .from('offres')
    .select('titre, entreprise, ville, contrat, description')
    .eq('id', offreId)
    .single()
  if (offreErr || !offre) throw new Error('Offre introuvable')

  const [cvBase64, lettreBase64] = await Promise.all([
    telechargerPdf(client, profil.cv_url),
    telechargerPdf(client, profil.lettre_url),
  ])

  const contenu = await appeler({
    offre: offre as OffreInfo,
    profil: { nom: profil.nom, titre_recherche: profil.titre_recherche },
    cvBase64,
    lettreBase64,
  })

  return upsertCandidature(client, userId, offreId, contenu)
}
