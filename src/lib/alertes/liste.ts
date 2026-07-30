import type { SupabaseClient } from '@supabase/supabase-js'

export type Alerte = { id: string; intitule: string; lieu_label: string | null }

// Alertes actives de l'utilisateur : recherches dont l'alerte mail est activée.
export async function getAlertes(client: SupabaseClient, userId: string): Promise<Alerte[]> {
  const { data, error } = await client
    .from('recherches')
    .select('id, intitule, lieu_label')
    .eq('user_id', userId)
    .eq('alertes_email', true)
    .order('intitule', { ascending: true })
  if (error) throw error
  return (data ?? []) as Alerte[]
}
