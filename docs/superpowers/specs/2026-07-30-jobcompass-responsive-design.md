# JobCompass · Responsive / mobile friendly

**Date :** 2026-07-30
**Statut :** validé (design)

## Objectif

Rendre toute l'application JobCompass utilisable et agréable sur mobile (téléphones et
tablettes en portrait), avant le déploiement public sur Render. Aucune régression sur
desktop. Objectif transverse : **aucun débordement horizontal** sur aucune page, à aucune
largeur.

## Principes

- Approche **mobile-adapté** par media queries dans `src/app/globals.css` : on adapte les
  mises en page existantes, on ne refait pas les composants.
- **Breakpoints** :
  - `max-width: 768px` : bascule mobile principale (téléphones + tablettes portrait).
  - `max-width: 480px` : ajustements fins pour petits téléphones.
- **Viewport** : figé explicitement via `export const viewport` dans `src/app/layout.tsx`
  (`width=device-width, initialScale: 1`), sans bloquer le zoom (accessibilité).
- **Cibles tactiles** : éléments interactifs à hauteur ≥ 44px sur mobile.
- Aucune dépendance ajoutée.

## Page résultats (`/recherche/[id]`)

C'est le seul changement structurel (le reste est du CSS).

### Bascule Liste / Carte (mobile)
- Sur mobile, une **barre segmentée « Liste | Carte »** apparaît sous l'en-tête. La liste
  et la carte occupent chacune **toute la largeur** ; on affiche l'une OU l'autre.
- État `vue: 'liste' | 'carte'` ajouté à `resultats-shell.tsx` (défaut `'liste'`). La carte
  (`CarteOffres`) **reste montée** en permanence (juste masquée en CSS quand `vue==='carte'`
  est faux) pour ne pas détruire/recréer Leaflet à chaque bascule.
- Le rendu conditionnel se fait par classes CSS sur le conteneur `.split` :
  `.split.vue-liste` masque `.map-pane`, `.split.vue-carte` masque `.list-pane`. Ces règles
  ne s'appliquent que sous 768px (desktop inchangé : les deux volets côte à côte).
- Le bouton de bascule existant `.map-toggle` (qui replie la liste sur desktop) est **masqué
  sur mobile** (remplacé par la barre segmentée).
- Composant `SegmentLizteCarte` (ou inline dans `resultats-shell`) : deux boutons
  `Liste` / `Carte`, `aria-pressed` sur l'actif, appelle `setVue`.

### En-tête compact (mobile)
- `.topbar` : logo réduit, boutons **Filtres** et **Alertes** réduits à leur icône (label
  masqué sous 768px via `.filtres-btn span`/texte). Le `.poste-chip` se tronque
  (`text-overflow: ellipsis`, largeur max) pour ne pas pousser la barre.
- `.topnav-right` (cloche + avatar compte) reste en haut à droite ; on réserve l'espace à
  droite dans `.topbar` pour éviter tout chevauchement (padding droit suffisant sous 768px).
- `.filtres-panel` : passe en **pleine largeur** sous 768px (au lieu du dropdown ~300px),
  ancré sous la barre, avec `left/right` à la marge d'écran ; le slider et les champs
  restent confortables.

## Autres pages (empilement)

- **Offre** (`offre-detail`) : `.detail-grid` déjà en une colonne < 760px → aligner sur 768,
  vérifier `.detail-hero`, `.side-card`, `.side-map`, `.detail-top` (retour + logo), et
  passer les boutons d'action en pleine largeur.
- **Candidature IA** (`candidature-editor`) : cartes email/lettre empilées, `textarea` et
  boutons pleine largeur, paddings réduits.
- **Suivi** (`suivi-*`) : `.suivi-stats` en 2 colonnes < 620px (déjà), 1 colonne < 480px ;
  cartes `.suivi-carte` pleine largeur ; bandeau « à relancer » adapté.
- **Favoris / Profil / Paramètres** : conteneurs `.detail-wrap` / `.side-card` en pleine
  largeur avec marges réduites ; `.alertes-profil-*` et `.profil-*` empilés proprement.
- **Accueil** (`hero`, `searchbar`) : barre de recherche pleine largeur, `.headline` en
  `clamp` (déjà), paddings réduits, décor non débordant.
- **Modales** (`.pm-*`) et **bulle du tuto** (`.tour-bulle`) : déjà bornées
  (`max-width: calc(100vw - 32px)`), vérifier le rendu à 360px.

## Règles globales

- `html, body { overflow-x: hidden; }` en filet de sécurité, mais la vraie correction est
  de supprimer les causes de débordement (largeurs fixes, marges négatives).
- Conteneurs à largeur fixe (`.list-pane` 440px, `.filtres-panel`, `.tour-bulle`) bornés par
  `max-width: 100%` / media queries.
- Tailles de police mini lisibles (≥ 14px pour le corps sur mobile).

## Fichiers touchés

- `src/app/globals.css` : l'essentiel (nouvelles media queries `max-width: 768px` et
  `max-width: 480px`, regroupées dans une section « Responsive » en fin de fichier).
- `src/app/layout.tsx` : ajout de `export const viewport`.
- `src/components/resultats-shell.tsx` : état `vue`, barre segmentée, classes
  `.split.vue-liste` / `.split.vue-carte`.
- Éventuellement un petit composant `src/components/segment-vue.tsx` pour la bascule.

## Tests

- Le responsive est du CSS : validation **manuelle** aux largeurs 375, 414 et 768px
  (aucun débordement horizontal, chaque page utilisable, en-tête sans chevauchement).
- La bascule Liste/Carte ajoute un état testable : test unitaire (Vitest + RTL) vérifiant
  que cliquer « Carte » puis « Liste » met à jour la vue active (classe/`aria-pressed`).
- Tous les tests existants (150) restent verts ; `next build` OK.

## Contraintes transverses (rappel)

- Français, jamais de tiret cadratin `—` (utiliser `:`, `,` ou `·`).
- Respect de `prefers-reduced-motion` (déjà en place).
- Aucune régression du rendu desktop.
