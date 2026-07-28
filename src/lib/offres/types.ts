export type OffreRow = {
  id: string
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

export const OFFRE_COLUMNS =
  'id, source, source_id, titre, entreprise, entreprise_logo, description, contrat, salaire, latitude, longitude, ville, url_postuler, email_contact, date_publication'
