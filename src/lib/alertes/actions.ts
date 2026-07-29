'use server'

import { getServerClient } from '@/lib/supabase/server'
import { marquerOffreVue } from './boite'

export async function marquerVue(offreId: string): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await marquerOffreVue(supabase, user.id, offreId)
}
