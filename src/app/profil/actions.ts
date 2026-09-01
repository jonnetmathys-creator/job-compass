'use server'

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/service'
import { getProfil, upsertProfil } from '@/lib/profil'
import { nettoyerCles } from '@/lib/preferences'

// Vrai si les deux ensembles de clés diffèrent (ordre-insensible).
function preferencesDifferentes(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return true
  const sa = [...a].sort().join('|')
  const sb = [...b].sort().join('|')
  return sa !== sb
}

// Enregistre identité + préférences. Si les préférences changent, purge le cache de
// scores de l'utilisateur pour qu'ils se recalculent (au prochain rafraîchissement).
export async function enregistrerProfil(patch: {
  nom: string | null; titre_recherche: string | null; preferences: string[]
  adresse?: string | null; code_postal?: string | null; ville?: string | null
  telephone?: string | null; email?: string | null
}): Promise<{ ok: boolean; erreur?: string }> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erreur: 'Non authentifié' }

  const preferences = nettoyerCles(patch.preferences ?? [])
  const avant = await getProfil(supabase, user.id)
  const prefsAvant = avant?.preferences ?? []

  try {
    await upsertProfil(supabase, user.id, {
      nom: patch.nom, titre_recherche: patch.titre_recherche, preferences,
      adresse: patch.adresse ?? null, code_postal: patch.code_postal ?? null,
      ville: patch.ville ?? null, telephone: patch.telephone ?? null, email: patch.email ?? null,
    })
  } catch {
    return { ok: false, erreur: "Échec de l'enregistrement, réessayez." }
  }

  if (preferencesDifferentes(prefsAvant, preferences)) {
    // Purge best-effort via le service (pas de dépendance à une règle RLS de suppression).
    try {
      await getServiceClient().from('scores').delete().eq('user_id', user.id)
    } catch (e) {
      console.error('[profil] purge des scores en échec :', e)
    }
  }

  revalidatePath('/profil')
  return { ok: true }
}
