import type { SupabaseClient } from '@supabase/supabase-js'
import { envoiGmail, type EnvoiMail } from '@/lib/alertes/email'
import { buildRelanceEmailHtml, sujetRelance, type OffreRelance } from './email'

type Brut = { user_id: string; offre_id: string; offres: OffreRelance | OffreRelance[] | null }

type Deps = {
  envoi?: EnvoiMail
  // Résolution de l'email d'un utilisateur (admin). Injectable pour les tests.
  emailDe?: (client: SupabaseClient, userId: string) => Promise<string | null>
  today?: string
}

async function emailAdmin(client: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await client.auth.admin.getUserById(userId)
    return data?.user?.email ?? null
  } catch {
    return null
  }
}

// Envoi (unique) des emails « candidatures à relancer » pour tous les utilisateurs.
// Cible : statut « postulee », relance due (relance_le <= aujourd'hui), jamais notifiée
// (relance_vue_le null). Après un envoi réussi, on pose relance_vue_le pour ne PAS
// re-notifier : la cloche prend ensuite le relais (réapparition hebdomadaire).
// Best-effort : sans compte Gmail configuré, ne fait rien et renvoie 0.
export async function notifierRelances(client: SupabaseClient, deps: Deps = {}): Promise<number> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return 0
  const envoi = deps.envoi ?? envoiGmail
  const emailDe = deps.emailDe ?? emailAdmin
  const today = deps.today ?? new Date().toISOString().slice(0, 10)
  const baseUrl = process.env.ALERTE_BASE_URL ?? 'https://jobcompass.app'
  const from = process.env.ALERTE_FROM ?? `JobCompass <${process.env.GMAIL_USER}>`

  const { data, error } = await client
    .from('candidatures')
    .select('user_id, offre_id, offres:offre_id (id, titre, entreprise, ville)')
    .eq('statut', 'postulee')
    .not('relance_le', 'is', null)
    .lte('relance_le', today)
    .is('relance_vue_le', null)
  if (error || !data) return 0

  // Regroupe par utilisateur.
  const parUser = new Map<string, { offres: OffreRelance[]; offreIds: string[] }>()
  for (const r of data as Brut[]) {
    const offre = (Array.isArray(r.offres) ? r.offres[0] : r.offres) as OffreRelance | null
    if (!offre) continue
    const g = parUser.get(r.user_id) ?? { offres: [], offreIds: [] }
    g.offres.push(offre)
    g.offreIds.push(r.offre_id)
    parUser.set(r.user_id, g)
  }

  let envoyes = 0
  for (const [userId, g] of parUser) {
    const to = await emailDe(client, userId)
    if (!to) continue
    const ok = await envoi({
      from,
      to,
      subject: sujetRelance(g.offres),
      html: buildRelanceEmailHtml(g.offres, baseUrl),
    })
    if (!ok) continue
    envoyes += 1
    // Marque notifiées pour ne pas renvoyer : la cloche continuera de rappeler.
    await client.from('candidatures')
      .update({ relance_vue_le: new Date().toISOString() })
      .eq('user_id', userId).in('offre_id', g.offreIds)
  }
  return envoyes
}
