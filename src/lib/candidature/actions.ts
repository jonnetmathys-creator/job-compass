'use server'

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { genererCandidatureCore } from './generation'
import { retoucherLettreCore } from './retouche'
import { upsertCandidature } from './lecture'
import type { Candidature, CandidatureContenu } from './types'

export async function genererCandidature(offreId: string): Promise<Candidature> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const cand = await genererCandidatureCore({ client: supabase, userId: user.id, offreId })
  revalidatePath(`/offre/${offreId}/candidature`)
  return cand
}

// Retouche IA du corps de la lettre selon une consigne (raccourcir, ton…).
// Ne persiste rien : renvoie juste le texte réécrit, l'UI l'applique puis l'enregistre.
export async function retoucherLettre(texte: string, consigne: string): Promise<string> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  if (!texte.trim()) return texte
  return retoucherLettreCore(texte, consigne)
}

export async function enregistrerCandidature(offreId: string, patch: CandidatureContenu): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  await upsertCandidature(supabase, user.id, offreId, patch)
  revalidatePath(`/offre/${offreId}/candidature`)
}
