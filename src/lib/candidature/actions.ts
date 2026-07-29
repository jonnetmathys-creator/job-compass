'use server'

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { genererCandidatureCore } from './generation'
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

export async function enregistrerCandidature(offreId: string, patch: CandidatureContenu): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  await upsertCandidature(supabase, user.id, offreId, patch)
  revalidatePath(`/offre/${offreId}/candidature`)
}
