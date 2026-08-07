import type { SupabaseClient } from '@supabase/supabase-js'
import { rafraichirRecherche, enregistrerNouvelles } from './detection'
import { envoyerAlerte } from './email'

export type RechercheAref = {
  id: string
  user_id: string
  intitule: string
  mots_cles: string[]
  localisation: string | null
  rayon_km: number | null
  type_contrat: string | null
  alertes_email: boolean
}

type Deps = {
  rafraichir?: typeof rafraichirRecherche
  enregistrer?: typeof enregistrerNouvelles
}

// Collecte + enregistrement des nouvelles offres pour l'utilisateur. Ne fait PAS l'email :
// le scoring doit tourner entre l'enregistrement et l'envoi (voir /api/refresh).
export async function rafraichirEtEnregistrer(
  client: SupabaseClient,
  recherche: RechercheAref,
  deps: Deps = {},
): Promise<{ nouvelles: number; ids: string[] }> {
  const rafraichir = deps.rafraichir ?? rafraichirRecherche
  const enregistrer = deps.enregistrer ?? enregistrerNouvelles

  const { nouvelles } = await rafraichir(client, recherche)
  const nb = await enregistrer(client, recherche.user_id, recherche.id, nouvelles)
  return { nouvelles: nb, ids: nouvelles }
}

type EnvoiDeps = { envoyer?: typeof envoyerAlerte }

// Envoie l'email d'alerte si l'utilisateur a opté et qu'il y a des offres. À appeler APRÈS le scoring.
export async function envoyerAlerteSiActive(
  client: SupabaseClient,
  recherche: Pick<RechercheAref, 'id' | 'user_id' | 'intitule' | 'alertes_email'>,
  ids: string[],
  deps: EnvoiDeps = {},
): Promise<boolean> {
  const envoyer = deps.envoyer ?? envoyerAlerte
  if (!recherche.alertes_email || ids.length === 0) return false
  // Lookup du destinataire (best-effort) : une erreur ne bloque pas le hook email.
  let to: string | null = null
  try {
    const { data } = await client.auth.admin.getUserById(recherche.user_id)
    to = data?.user?.email ?? null
  } catch {
    to = null
  }
  return envoyer({ to, recherche, offreIds: ids }, client)
}
