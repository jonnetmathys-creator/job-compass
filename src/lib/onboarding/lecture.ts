import type { SupabaseClient } from '@supabase/supabase-js'

export async function estOnboardingTermine(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await client
    .from('profils').select('onboarding_termine').eq('user_id', userId).maybeSingle()
  return data?.onboarding_termine ?? false
}
