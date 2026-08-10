import { setDefaultResultOrder } from 'node:dns'
import nodemailer from 'nodemailer'
import type { SupabaseClient } from '@supabase/supabase-js'

// Render n'a pas de route IPv6 vers le SMTP Gmail (ENETUNREACH sur l'AAAA) :
// on privilégie l'IPv4 pour la résolution DNS de tout le process serveur.
try { setDefaultResultOrder('ipv4first') } catch { /* environnement sans dns */ }
import { getScores } from '@/lib/scoring/lecture'
import { couleurScore, estTopMatch } from '@/lib/scoring/palette'

type OffreMail = { id: string; titre: string; entreprise: string | null; ville: string | null; score?: number }

// Y a-t-il une offre « top match » (>= 90) ? Renvoie aussi le meilleur score.
export function bandeauTopMatch(offres: { score?: number }[]): { top: boolean; maxScore: number } {
  const maxScore = offres.reduce((m, o) => (typeof o.score === 'number' && o.score > m ? o.score : m), 0)
  return { top: estTopMatch(maxScore), maxScore }
}

export function buildEmailHtml(intitule: string, offres: OffreMail[], baseUrl: string): string {
  // Meilleur match en tête (offres sans score en fin).
  const triees = [...offres].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const { top, maxScore } = bandeauTopMatch(triees)
  const bandeau = top
    ? `<p style="background:#eafaf0;border:1px solid #bfe6cd;border-radius:10px;padding:12px 14px;color:#1c1e21;font-weight:700">🎯 Une offre correspond à ${maxScore}% à ton profil !</p>`
    : ''
  const items = triees
    .map((o) => {
      const lieu = [o.entreprise, o.ville].filter(Boolean).join(' · ')
      const badge = typeof o.score === 'number'
        ? ` <span style="background:${couleurScore(o.score)};color:#fff;border-radius:999px;padding:1px 7px;font-size:12px;font-weight:700">${o.score}%</span>`
        : ''
      return `<li style="margin:0 0 10px"><a href="${baseUrl}/offre/${o.id}" style="color:#248049;font-weight:600;text-decoration:none">${o.titre}</a>${badge}${lieu ? `<br><span style="color:#6b7280;font-size:13px">${lieu}</span>` : ''}</li>`
    })
    .join('')
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
<h2 style="color:#1c1e21">Nouvelles offres : ${intitule}</h2>
${bandeau}
<p style="color:#6b7280">Voici les nouvelles offres trouvées pour ta recherche :</p>
<ul style="list-style:none;padding:0">${items}</ul>
<p style="color:#9aa0a6;font-size:12px">JobCompass</p></div>`
}

export type MessageMail = { from: string; to: string; subject: string; html: string }
export type EnvoiMail = (msg: MessageMail) => Promise<boolean>

// Envoi réel via SMTP Gmail (compte dédié + mot de passe d'application).
export async function envoiGmail(msg: MessageMail): Promise<boolean> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return false
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  const info = await transport.sendMail(msg)
  return (info.accepted?.length ?? 0) > 0
}

export async function envoyerAlerte(
  params: { to: string | null; recherche: { id: string; intitule?: string; user_id?: string }; offreIds: string[] },
  client: SupabaseClient,
  deps: { envoi?: EnvoiMail; getScores?: typeof getScores } = {},
): Promise<boolean> {
  if (!params.to) return false
  const user = process.env.GMAIL_USER
  // Best-effort : sans compte Gmail configuré, on n'envoie rien (pas d'erreur).
  if (!user || !process.env.GMAIL_APP_PASSWORD) return false

  const { data } = await client
    .from('offres')
    .select('id, titre, entreprise, ville')
    .in('id', params.offreIds)
  const brutes = (data ?? []) as { id: string; titre: string; entreprise: string | null; ville: string | null }[]
  if (brutes.length === 0) return false

  const lireScores = deps.getScores ?? getScores
  const scores = await lireScores(client, params.recherche.user_id ?? '', params.offreIds)
  const offres: OffreMail[] = brutes.map((o) => ({ ...o, score: scores.get(o.id)?.score }))

  const intitule = params.recherche.intitule ?? 'ta recherche'
  const { top, maxScore } = bandeauTopMatch(offres)
  const baseUrl = process.env.ALERTE_BASE_URL ?? 'https://jobcompass.app'
  const from = process.env.ALERTE_FROM ?? `JobCompass <${user}>`
  const envoi = deps.envoi ?? envoiGmail
  return envoi({
    from,
    to: params.to,
    subject: top ? `🎯 Top match (${maxScore}%) · ${intitule}` : `Nouvelles offres : ${intitule}`,
    html: buildEmailHtml(intitule, offres, baseUrl),
  })
}
