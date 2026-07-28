import { createClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/env'

// Rôle service : contourne la RLS. À n'utiliser QUE côté serveur (collecte, plan 2).
export function getServiceClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )
}
