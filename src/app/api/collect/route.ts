import { NextResponse } from 'next/server'
import { requireEnv } from '@/lib/env'
import { getServiceClient } from '@/lib/supabase/service'
import { collectForRecherche } from '@/lib/collector/collect'
import type { RechercheRow } from '@/lib/collector/types'

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${requireEnv('COLLECT_SECRET')}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  let body: { recherche_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }
  const { recherche_id } = body
  if (!recherche_id) {
    return NextResponse.json({ error: 'recherche_id manquant' }, { status: 400 })
  }
  const client = getServiceClient()
  const { data: recherche, error } = await client
    .from('recherches')
    .select('id, intitule, mots_cles, localisation, rayon_km, type_contrat')
    .eq('id', recherche_id)
    .single()
  if (error || !recherche) {
    return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
  }
  const result = await collectForRecherche(client, recherche as RechercheRow & { id: string })
  return NextResponse.json(result)
}
