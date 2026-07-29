import { NextResponse } from 'next/server'
import { requireEnv } from '@/lib/env'
import { getServiceClient } from '@/lib/supabase/service'
import { rafraichirEtEnregistrer, type RechercheAref } from '@/lib/alertes/refresh'

const COLS = 'id, user_id, intitule, mots_cles, localisation, rayon_km, type_contrat, alertes_email'

function autorise(request: Request): boolean {
  return request.headers.get('authorization') === `Bearer ${requireEnv('COLLECT_SECRET')}`
}

async function traiter(recherches: RechercheAref[]) {
  const client = getServiceClient()
  let nouvelles = 0
  let emails = 0
  for (const r of recherches) {
    const res = await rafraichirEtEnregistrer(client, r)
    nouvelles += res.nouvelles
    if (res.email) emails += 1
  }
  return { recherches: recherches.length, nouvelles, emails }
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
