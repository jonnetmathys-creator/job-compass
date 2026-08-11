import type { SupabaseClient } from '@supabase/supabase-js'

export type Profil = {
  user_id: string
  nom: string | null
  titre_recherche: string | null
  cv_url: string | null
  cv_texte: string | null
  lettre_base: string | null
  lettre_url: string | null
  preferences: string[]
}

export async function getProfil(client: SupabaseClient, userId: string): Promise<Profil | null> {
  const { data, error } = await client.from('profils').select('*').eq('user_id', userId).single()
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = aucune ligne
  return (data as Profil) ?? null
}

export async function upsertProfil(
  client: SupabaseClient,
  userId: string,
  patch: Partial<Omit<Profil, 'user_id'>>,
): Promise<Profil> {
  const { data, error } = await client
    .from('profils')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data as Profil
}

export async function uploadCv(client: SupabaseClient, userId: string, file: File): Promise<string> {
  const path = `${userId}/cv.pdf`
  const { error } = await client.storage.from('cv').upload(path, file, {
    upsert: true, contentType: 'application/pdf',
  })
  if (error) throw error
  await upsertProfil(client, userId, { cv_url: path, cv_texte: null })
  return path
}

export async function uploadLettre(client: SupabaseClient, userId: string, file: File): Promise<string> {
  const path = `${userId}/lettre.pdf`
  const { error } = await client.storage.from('cv').upload(path, file, {
    upsert: true, contentType: 'application/pdf',
  })
  if (error) throw error
  await upsertProfil(client, userId, { lettre_url: path })
  return path
}
