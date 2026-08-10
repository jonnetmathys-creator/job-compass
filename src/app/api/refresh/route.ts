import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase/service'
import { rafraichirEtEnregistrer, envoyerAlerteSiActive, type RechercheAref } from '@/lib/alertes/refresh'
import { purgerVieillesOffres, purgerVieillesNotifs } from '@/lib/alertes/purge'
import { scorerPourRecherche } from '@/lib/scoring/execution'
import { notifierRelances } from '@/lib/relances/notify'

const COLS = 'id, user_id, intitule, mots_cles, localisation, rayon_km, type_contrat, alertes_email'

// Accepte un bearer correspondant à COLLECT_SECRET (usage manuel/local) ou CRON_SECRET
// (injecté automatiquement par le cron Vercel). Aucun throw si les secrets sont absents :
// la requête est simplement refusée (401) plutôt que de faire planter le serveur (500).
export function autorise(request: Request): boolean {
  const header = request.headers.get('authorization')
  const secrets = [process.env.COLLECT_SECRET, process.env.CRON_SECRET].filter(Boolean)
  return secrets.length > 0 && secrets.some((s) => header === `Bearer ${s}`)
}

async function traiter(recherches: RechercheAref[]) {
  const client = getServiceClient()
  let nouvelles = 0
  let emails = 0
  let scores = 0
  for (const r of recherches) {
    // Ordre : collecte -> scoring -> email (l'email peut ainsi afficher les scores).
    const { nouvelles: nb, ids } = await rafraichirEtEnregistrer(client, r)
    nouvelles += nb
    try { scores += await scorerPourRecherche(client, r) }
    catch (e) { console.error('[refresh] scoring en échec :', e) }
    if (nb > 0 && await envoyerAlerteSiActive(client, r, ids)) emails += 1
  }
  let purgees = 0
  try { purgees = await purgerVieillesOffres(client) }
  catch (e) { console.error('[refresh] purge en échec :', e) }
  try { await purgerVieillesNotifs(client) }
  catch (e) { console.error('[refresh] purge notifs en échec :', e) }
  let relances = 0
  try { relances = await notifierRelances(client) }
  catch (e) { console.error('[refresh] relances en échec :', e) }
  return { recherches: recherches.length, nouvelles, emails, purgees, scores, relances }
}

async function recherchesCibles(rechercheId?: string): Promise<RechercheAref[]> {
  const client = getServiceClient()
  const q = client.from('recherches').select(COLS)
  const { data, error } = rechercheId ? await q.eq('id', rechercheId) : await q
  if (error) throw error
  return (data ?? []) as RechercheAref[]
}

export async function POST(request: Request) {
  if (!autorise(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  let body: { recherche_id?: string; all?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  if (!body.recherche_id && !body.all) return NextResponse.json({ error: 'recherche_id ou all requis' }, { status: 400 })
  const cibles = await recherchesCibles(body.all ? undefined : body.recherche_id)
  return NextResponse.json(await traiter(cibles))
}

export async function GET(request: Request) {
  if (!autorise(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const cibles = await recherchesCibles()
  return NextResponse.json(await traiter(cibles))
}
