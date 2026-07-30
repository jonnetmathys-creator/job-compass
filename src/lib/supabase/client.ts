import { createBrowserClient } from '@supabase/ssr'

// NB : lecture STATIQUE de process.env.NEXT_PUBLIC_* (pas via requireEnv/lookup
// dynamique) car Next.js n'inline dans le bundle navigateur que les accès
// statiques à process.env.NEXT_PUBLIC_*. Un accès dynamique (process.env[name])
// resterait `undefined` côté client en production.
export function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      "Config Supabase navigateur manquante (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    )
  }
  // detectSessionInUrl: false -> le lien de confirmation d'email ne connecte PAS
  // automatiquement. L'adresse est validée côté Supabase au clic, mais aucune session
  // n'est ouverte depuis l'URL : l'utilisateur doit ressaisir email + mot de passe.
  return createBrowserClient(url, anonKey, { auth: { detectSessionInUrl: false } })
}
