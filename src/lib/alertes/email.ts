import nodemailer from 'nodemailer'
import type { SupabaseClient } from '@supabase/supabase-js'

export function buildEmailHtml(
  intitule: string,
  offres: { id: string; titre: string; entreprise: string | null; ville: string | null }[],
  baseUrl: string,
): string {
  const items = offres
    .map((o) => {
      const lieu = [o.entreprise, o.ville].filter(Boolean).join(' · ')
      return `<li style="margin:0 0 10px"><a href="${baseUrl}/offre/${o.id}" style="color:#248049;font-weight:600;text-decoration:none">${o.titre}</a>${lieu ? `<br><span style="color:#6b7280;font-size:13px">${lieu}</span>` : ''}</li>`
    })
    .join('')
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
<h2 style="color:#1c1e21">Nouvelles offres : ${intitule}</h2>
<p style="color:#6b7280">Voici les nouvelles offres trouvées pour ta recherche :</p>
<ul style="list-style:none;padding:0">${items}</ul>
<p style="color:#9aa0a6;font-size:12px">JobCompass</p></div>`
}

export type MessageMail = { from: string; to: string; subject: string; html: string }
export type EnvoiMail = (msg: MessageMail) => Promise<boolean>

// Envoi réel via SMTP Gmail (compte dédié + mot de passe d'application).
async function envoiGmail(msg: MessageMail): Promise<boolean> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return false
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  const info = await transport.sendMail(msg)
  return (info.accepted?.length ?? 0) > 0
}

export async function envoyerAlerte(
  params: { to: string | null; recherche: { id: string; intitule?: string }; offreIds: string[] },
  client: SupabaseClient,
  deps: { envoi?: EnvoiMail } = {},
): Promise<boolean> {
  if (!params.to) return false
  const user = process.env.GMAIL_USER
  // Best-effort : sans compte Gmail configuré, on n'envoie rien (pas d'erreur).
  if (!user || !process.env.GMAIL_APP_PASSWORD) return false

  const { data } = await client
    .from('offres')
    .select('id, titre, entreprise, ville')
    .in('id', params.offreIds)
  const offres = (data ?? []) as { id: string; titre: string; entreprise: string | null; ville: string | null }[]
  if (offres.length === 0) return false

  const baseUrl = process.env.ALERTE_BASE_URL ?? 'https://jobcompass.app'
  const from = process.env.ALERTE_FROM ?? `JobCompass <${user}>`
  const envoi = deps.envoi ?? envoiGmail
  return envoi({
    from,
    to: params.to,
    subject: `Nouvelles offres : ${params.recherche.intitule ?? 'ta recherche'}`,
    html: buildEmailHtml(params.recherche.intitule ?? 'ta recherche', offres, baseUrl),
  })
}
