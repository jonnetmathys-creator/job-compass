export type Candidature = {
  user_id: string
  offre_id: string
  email_objet: string | null
  email_corps: string | null
  lettre: string | null
  statut: string
}

export type CandidatureContenu = {
  email_objet: string
  email_corps: string
  lettre: string
}

// Sous-ensemble de l'offre transmis au moteur Gemini.
export type OffreInfo = {
  titre: string
  entreprise: string | null
  ville: string | null
  contrat: string | null
  description: string | null
}

// Sous-ensemble du profil transmis au moteur Gemini.
export type ProfilInfo = {
  nom: string | null
  titre_recherche: string | null
}

export type GeminiParams = {
  offre: OffreInfo
  profil: ProfilInfo
  cvBase64: string
  lettreBase64: string
}
