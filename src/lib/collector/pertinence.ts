import type { NormalizedOffer } from './types'

// Adzuna et Jooble cherchent le mot-clé en PLEIN TEXTE, sans code métier : une
// recherche « nutrition » remonte des médecins, infirmiers, commerciaux perfusion,
// nutrition animale, enseignants… Le seul signal fiable du métier de diététicien
// est la présence de « diététicien / diététique » dans l'intitulé (le titre
// professionnel est protégé en France, il figure toujours dans le titre de l'offre).
//
// On garde donc une offre plein-texte uniquement si son TITRE contient ce radical.
// (Sans accents inclus : « dieteticien », « dietetique ».) France Travail — déjà
// contraint par le code ROME J1402 — et l'AFDN — 100 % diététique — ne passent pas
// par ce filtre.
const RE_DIETETIQUE = /di[ée]t[ée]ti/i

export function estPertinenteDietetique(o: NormalizedOffer): boolean {
  return RE_DIETETIQUE.test(o.titre ?? '')
}
