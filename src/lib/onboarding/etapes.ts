export type Etape = {
  id: string
  page: RegExp
  cible: string
  titre: string
  texte: string
  placement: 'haut' | 'bas' | 'gauche' | 'droite'
  action?: 'recherche' | 'offre'
}

// Parcours de la visite guidée (voir la spec). Les motifs `page` disent sur quelle
// route l'étape s'affiche ; `cible` est un sélecteur `data-tour` posé sur l'UI réelle.
export const ETAPES: Etape[] = [
  { id: 'recherche', page: /^\/$/, cible: '[data-tour="recherche"]', placement: 'bas', action: 'recherche',
    titre: 'Commence ici', texte: 'Tape le métier que tu cherches, puis clique Suivant pour voir un exemple de résultats.' },
  { id: 'filtres', page: /^\/recherche\//, cible: '[data-tour="filtres"]', placement: 'bas',
    titre: 'Affine tes résultats', texte: 'Filtre par lieu, distance et type de contrat.' },
  { id: 'liste', page: /^\/recherche\//, cible: '[data-tour="liste"]', placement: 'droite',
    titre: 'Tes offres', texte: 'Toutes les offres trouvées s’affichent ici, du plus récent au plus ancien.' },
  { id: 'score', page: /^\/recherche\//, cible: '[data-offre-id]', placement: 'droite',
    titre: 'Le score IA', texte: 'Une fois ton CV analysé, chaque offre reçoit un score de 0 à 100 selon ton profil. Plus le pourcentage tire vers le vert, plus l’offre te correspond. Au-dessus de 90, on te prévient direct.' },
  { id: 'carte', page: /^\/recherche\//, cible: '[data-tour="carte"]', placement: 'gauche',
    titre: 'Sur la carte', texte: 'Chaque pin est une offre : clique dessus pour l’ouvrir.' },
  { id: 'like', page: /^\/recherche\//, cible: '[data-tour="like"]', placement: 'droite',
    titre: 'Sauvegarde', texte: 'Un coup de cœur ? Garde l’offre pour la retrouver dans tes offres likées.' },
  { id: 'cloche', page: /^\/recherche\//, cible: '[data-tour="cloche"]', placement: 'gauche', action: 'offre',
    titre: 'Notifications', texte: 'Nouvelles offres et rappels de candidature arrivent dans cette cloche. Clique Suivant pour ouvrir une offre.' },
  { id: 'postuler', page: /^\/offre\//, cible: '[data-tour="postuler"]', placement: 'gauche',
    titre: 'Postule', texte: 'Prêt·e ? Postule en un clic depuis ce bouton, par email ou sur France Travail.' },
  { id: 'candidature-ia', page: /^\/offre\//, cible: '[data-tour="candidature-ia"]', placement: 'gauche',
    titre: 'Candidature IA', texte: 'Laisse l’IA rédiger un mail et une lettre personnalisés à partir de ton CV.' },
  { id: 'compte', page: /^\/(recherche|offre)\//, cible: '[data-tour="compte"]', placement: 'gauche',
    titre: 'Ton espace', texte: 'Profil, offres likées et suivi de tes candidatures sont ici. Bonne chasse !' },
]

export function etapeSuivante(index: number, total: number): number {
  return Math.min(index + 1, total - 1)
}

export function etapePrecedente(index: number): number {
  return Math.max(index - 1, 0)
}

export function estDerniere(index: number, total: number): boolean {
  return index === total - 1
}

export function pageCorrespond(etape: Etape, pathname: string): boolean {
  return etape.page.test(pathname)
}
