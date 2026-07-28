import { NextResponse } from 'next/server'
import { requireEnv } from '@/lib/env'
import { getServiceClient } from '@/lib/supabase/service'
import { collectForRecherche } from '@/lib/collector/collect'

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${requireEnv('COLLECT_SECRET')}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { recherche_id } = await request.json()
  if (!recherche_id) {
    return NextResponse.json({ error: 'recherche_id manquant' }, { status: 400 })
  }
  const client = getServiceClient()
  const { data: recherche, error } = await client
    .from('recherches')
    .select('id, mots_cles, localisation, rayon_km, type_contrat')
    .eq('id', recherche_id)
    .single()
  if (error || !recherche) {
    return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
  }
  const result = await collectForRecherche(client, recherche as any)
  return NextResponse.json(result)
}
