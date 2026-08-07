'use server'

import { getServerClient } from '@/lib/supabase/server'
import { getRelancesDues, type RelanceDue } from './lecture'

// Date du jour au format yyyy-mm-dd (UTC), cohérent avec relance_le (stockée en date).
function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10)
}

// Relances dues et affichables pour l'utilisateur connecté (pour la cloche).
export async function getRelances(): Promise<{ items: RelanceDue[]; nonVus: number }> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { items: [], nonVus: 0 }
  return getRelancesDues(supabase, user.id, aujourdhui(), Date.now())
}

// La relance a été consultée : on la grise (réapparaîtra une semaine plus tard
// si la candidature est toujours « postulee »).
export async function marquerRelanceVue(offreId: string): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('candidatures')
    .update({ relance_vue_le: new Date().toISOString() })
    .eq('user_id', user.id).eq('offre_id', offreId)
}
