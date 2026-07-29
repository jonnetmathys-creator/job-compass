export type NormalizedOffer = {
  source: string
  source_id: string
  titre: string
  entreprise: string | null
  entreprise_logo: string | null
  description: string | null
  contrat: string | null
  salaire: string | null
  latitude: number | null
  longitude: number | null
  ville: string | null
  url_postuler: string | null
  email_contact: string | null
  date_publication: string | null
}

export type SearchParams = {
  motsCles: string[]
  codeRome: string
  commune?: string
  distance?: number
  typeContrat?: string
}

// Sous-ensemble des colonnes de `recherches` utilisées par le collecteur
export type RechercheRow = {
  mots_cles: string[]
  localisation: string | null
  rayon_km: number | null
  type_contrat: string | null
}
