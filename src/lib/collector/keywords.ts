import type { RechercheRow, SearchParams } from './types'

export const CODE_ROME_DIETETIQUE = 'J1402'
export const MOTS_CLES_DIETETIQUE = ['diététicien', 'diététique', 'nutrition']

export function buildSearchParams(recherche: RechercheRow): SearchParams {
  const motsCles = Array.from(new Set([...MOTS_CLES_DIETETIQUE, ...(recherche.mots_cles ?? [])]))
  return {
    motsCles,
    codeRome: CODE_ROME_DIETETIQUE,
    commune: recherche.localisation ?? undefined,
    distance: recherche.rayon_km ?? undefined,
    typeContrat: recherche.type_contrat ?? undefined,
  }
}
