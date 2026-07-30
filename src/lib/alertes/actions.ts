'use server'

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { marquerOffreVue } from './boite'

export async function marquerVue(offreId: string): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await marquerOffreVue(supabase, user.id, offreId)
}

export async function basculerAlertesEmail(rechercheId: string): Promise<{ actif: boolean }> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const { data: cur } = await supabase
    .from('recherches').select('alertes_email').eq('id', rechercheId).eq('user_id', user.id).single()
  const actif = !(cur?.alertes_email ?? false)
  const { error } = await supabase
    .from('recherches').update({ alertes_email: actif }).eq('id', rechercheId).eq('user_id', user.id)
  if (error) throw error
  revalidatePath(`/recherche/${rechercheId}`)
  return { actif }
}

// Désactive l'alerte mail d'une recherche (suppression depuis le profil).
export async function supprimerAlerte(rechercheId: string): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const { error } = await supabase
    .from('recherches').update({ alertes_email: false }).eq('id', rechercheId).eq('user_id', user.id)
  if (error) throw error
  revalidatePath('/profil')
}
