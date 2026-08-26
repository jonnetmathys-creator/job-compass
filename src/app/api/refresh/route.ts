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

// Budget de temps global (ms). Le refresh fait tout en synchrone dans UNE requête
// HTTP ; sans borne, la collecte + la notation de l'arriéré de toutes les recherches
// dépasse la limite de Render et renvoie un 502. On s'arrête proprement avant, en
// renvoyant 200 : les recherches non traitées le seront au prochain passage (elles
// sont classées « moins récentes d'abord », voir recherchesCibles). Réglable via env.
const BUDGET_MS = Number(process.env.REFRESH_BUDGET_MS) || 600_000 // 10 min

async function traiter(recherches: RechercheAref[]) {
  const client = getServiceClient()
  const deadline = Date.now() + BUDGET_MS
  let nouvelles = 0
  let emails = 0
  let scores = 0
  let traitees = 0
  for (const r of recherches) {
    if (Date.now() >= deadline) break // budget atteint : le reste sera repris au prochain passage
    traitees += 1
    // Chaque recherche est isolée : une erreur (collecte, scoring, email) est logguée
    // mais ne fait pas échouer tout le refresh.
    try {
      // Ordre : collecte -> scoring -> email (l'email peut ainsi afficher les scores).
      const { nouvelles: nb, ids } = await rafraichirEtEnregistrer(client, r)
      nouvelles += nb
      try { scores += await scorerPourRecherche(client, r, { deadline }) }
      catch (e) { console.error('[refresh] scoring en échec :', e) }
      try { if (nb > 0 && await envoyerAlerteSiActive(client, r, ids)) emails += 1 }
      catch (e) { console.error('[refresh] email en échec :', e) }
    } catch (e) {
      console.error('[refresh] recherche en échec :', r.id, e)
    }
  }
  const ignorees = recherches.length - traitees
  let purgees = 0
  try { purgees = await purgerVieillesOffres(client) }
  catch (e) { console.error('[refresh] purge en échec :', e) }
  try { await purgerVieillesNotifs(client) }
  catch (e) { console.error('[refresh] purge notifs en échec :', e) }
  let relances = 0
  try { relances = await notifierRelances(client) }
  catch (e) { console.error('[refresh] relances en échec :', e) }
  return { recherches: recherches.length, traitees, ignorees, nouvelles, emails, purgees, scores, relances }
}

async function recherchesCibles(rechercheId?: string): Promise<RechercheAref[]> {
  const client = getServiceClient()
  // « Moins récemment collectées d'abord » : si le budget de temps coupe le refresh,
  // les recherches sautées repassent en tête au run suivant (équité + rattrapage).
  const q = client.from('recherches').select(COLS).order('derniere_collecte', { ascending: true, nullsFirst: true })
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
