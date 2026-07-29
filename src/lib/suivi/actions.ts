'use server'

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { setPostulee, clearSuivi, setStatut, setDetailsSuivi, setRelanceEmail, supprimerCandidature as supprimerCandidatureDb } from './lecture'
import { estStatutSuivi } from './statuts'
import { ajouterJours } from './dates'
import { creerCandidatureManuelle, type FormManuelle } from './manuelle'
import { genererRelanceCore, type RelanceContenu } from './relance'

async function userOuErreur() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  return { supabase, userId: user.id }
}

export async function marquerPostulee(offreId: string): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const relance = ajouterJours(aujourdhui, 10)
  await setPostulee(supabase, userId, offreId, aujourdhui, relance)
  revalidatePath('/suivi')
}

export async function retirerDuSuivi(offreId: string): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  await clearSuivi(supabase, userId, offreId)
  revalidatePath('/suivi')
}

export async function changerStatut(offreId: string, statut: string): Promise<void> {
  if (!estStatutSuivi(statut)) throw new Error('Statut invalide')
  const { supabase, userId } = await userOuErreur()
  await setStatut(supabase, userId, offreId, statut)
  revalidatePath('/suivi')
}

export async function enregistrerSuivi(
  offreId: string,
  patch: { notes: string | null; relance_le: string | null },
): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  await setDetailsSuivi(supabase, userId, offreId, patch)
  revalidatePath('/suivi')
}

export async function ajouterCandidatureManuelle(form: FormManuelle): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  await creerCandidatureManuelle(supabase, userId, form)
  revalidatePath('/suivi')
}

export async function supprimerCandidature(offreId: string): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  await supprimerCandidatureDb(supabase, userId, offreId)
  revalidatePath('/suivi')
}

export async function genererRelance(offreId: string): Promise<RelanceContenu> {
  const { supabase, userId } = await userOuErreur()
  const contenu = await genererRelanceCore({ client: supabase, userId, offreId })
  revalidatePath('/suivi')
  return contenu
}

export async function enregistrerRelance(offreId: string, patch: { objet: string; corps: string }): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  await setRelanceEmail(supabase, userId, offreId, patch)
  revalidatePath('/suivi')
}
