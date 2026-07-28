'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/service'
import { collectForRecherche } from '@/lib/collector/collect'
import { geocodeCommune } from '@/lib/geo/adresse'
import { buildRechercheInsert } from './build'
import type { RechercheRow } from '@/lib/collector/types'

export async function lancerRecherche(poste: string): Promise<void> {
  const p = poste.trim()
  if (!p) return
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await supabase
    .from('recherches')
    .insert(buildRechercheInsert(user.id, p))
    .select('id')
    .single()
  if (error || !data) throw new Error('Création de la recherche impossible')
  const service = getServiceClient()
  const recherche: RechercheRow & { id: string } = {
    id: data.id, mots_cles: [p], localisation: null, rayon_km: null, type_contrat: null,
  }
  await collectForRecherche(service, recherche)
  redirect(`/recherche/${data.id}`)
}

export async function affinerLieu(
  rechercheId: string, ville: string, rayonKm: number | null,
): Promise<{ ok: boolean; erreur?: string }> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erreur: 'Non authentifié' }
  const geo = ville.trim() ? await geocodeCommune(ville) : null
  if (ville.trim() && !geo) return { ok: false, erreur: 'Lieu introuvable, précisez la commune.' }
  const { data: rech } = await supabase
    .from('recherches')
    .update({ localisation: geo ? geo.insee : null, rayon_km: rayonKm, latitude: geo ? geo.lat : null, longitude: geo ? geo.lng : null })
    .eq('id', rechercheId)
    .select('id, mots_cles, localisation, rayon_km, type_contrat')
    .single()
  if (!rech) return { ok: false, erreur: 'Recherche introuvable' }
  const service = getServiceClient()
  await collectForRecherche(service, rech as RechercheRow & { id: string })
  revalidatePath(`/recherche/${rechercheId}`)
  return { ok: true }
}
