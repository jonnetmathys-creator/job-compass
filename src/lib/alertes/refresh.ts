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
  envoyer?: typeof envoyerAlerte
}

export async function rafraichirEtEnregistrer(
  client: SupabaseClient,
  recherche: RechercheAref,
  deps: Deps = {},
): Promise<{ nouvelles: number; email: boolean }> {
  const rafraichir = deps.rafraichir ?? rafraichirRecherche
  const enregistrer = deps.enregistrer ?? enregistrerNouvelles
  const envoyer = deps.envoyer ?? envoyerAlerte

  const { nouvelles } = await rafraichir(client, recherche)
  const nb = await enregistrer(client, recherche.user_id, recherche.id, nouvelles)

  let email = false
  if (recherche.alertes_email && nb > 0) {
    // Récupère l'email du propriétaire (service client) en best-effort : une erreur
    // de lookup ne doit pas empêcher le hook email d'être invoqué (il gère lui-même
    // l'absence de destinataire).
    let to: string | null = null
    try {
      const { data } = await client.auth.admin.getUserById(recherche.user_id)
      to = data?.user?.email ?? null
    } catch {
      to = null
    }
    email = await envoyer({ to, recherche, offreIds: nouvelles }, client)
  }
  return { nouvelles: nb, email }
}
