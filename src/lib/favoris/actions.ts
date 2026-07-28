'use server'

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { getFavoriIds } from './lecture'

export async function toggleFavori(offreId: string): Promise<{ liked: boolean }> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const ids = await getFavoriIds(supabase, user.id)
  const already = ids.includes(offreId)
  if (already) {
    await supabase.from('favoris').delete().eq('user_id', user.id).eq('offre_id', offreId)
  } else {
    await supabase.from('favoris').insert({ user_id: user.id, offre_id: offreId })
  }
  revalidatePath('/profil')
  return { liked: !already }
}
