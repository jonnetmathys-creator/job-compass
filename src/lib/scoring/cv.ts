import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profil } from '@/lib/profil'
import { transcrirePdf } from '@/lib/candidature/gemini'

async function telechargerPdfBase64(client: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await client.storage.from('cv').download(path)
  if (error || !data) throw new Error('Téléchargement du CV impossible')
  const buf = Buffer.from(await data.arrayBuffer())
  return buf.toString('base64')
}

type Deps = {
  transcrire?: (base64: string) => Promise<string>
  telecharger?: (client: SupabaseClient, path: string) => Promise<string>
}

// Renvoie le CV en texte : le cache s'il existe, sinon l'extrait du PDF (et le met en cache).
// Renvoie null si l'utilisateur n'a pas de CV.
export async function assurerCvTexte(
  client: SupabaseClient, userId: string, profil: Profil, deps: Deps = {},
): Promise<string | null> {
  if (profil.cv_texte) return profil.cv_texte
  if (!profil.cv_url) return null
  const transcrire = deps.transcrire ?? ((b: string) => transcrirePdf(b))
  const telecharger = deps.telecharger ?? telechargerPdfBase64
  const base64 = await telecharger(client, profil.cv_url)
  const texte = await transcrire(base64)
  await client.from('profils').update({ cv_texte: texte }).eq('user_id', userId)
  return texte
}
