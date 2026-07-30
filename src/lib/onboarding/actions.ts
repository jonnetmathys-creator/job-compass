'use server'

import { getServerClient } from '@/lib/supabase/server'

async function definirFlag(valeur: boolean): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // upsert : crée la ligne profil si elle n'existe pas encore.
  await supabase.from('profils').upsert(
    { user_id: user.id, onboarding_termine: valeur },
    { onConflict: 'user_id' },
  )
}

export async function terminerOnboarding(): Promise<void> {
  await definirFlag(true)
}

export async function reinitialiserOnboarding(): Promise<void> {
  await definirFlag(false)
}
