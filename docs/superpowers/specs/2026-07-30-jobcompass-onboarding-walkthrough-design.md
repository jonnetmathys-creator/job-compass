# JobCompass · Visite guidée de première connexion (walkthrough)

**Date :** 2026-07-30
**Statut :** validé (design)

## Objectif

À la première connexion d'un utilisateur, lui faire découvrir l'application via une
visite guidée « spotlight » : un projecteur qui met en évidence, écran par écran, les
vrais éléments de l'interface, accompagné d'une bulle explicative. Le projecteur se
déplace de façon fluide d'un élément à l'autre. La visite couvre le parcours réel
(accueil → résultats → offre) et se termine par le suivi.

## Périmètre

- Visite **multi-pages** suivant le parcours réel.
- Déclenchement automatique à la première connexion uniquement.
- Rejouable à la demande depuis le profil.
- Aucune modification du rendu des composants existants : on leur ajoute seulement des
  attributs `data-tour="..."` servant de cibles.

Hors périmètre : personnalisation du contenu selon le profil, traduction, analytics.

## Détection & stockage

- Migration `0011_onboarding.sql` : ajoute `onboarding_termine boolean not null default
  false` à `public.profils`.
- Le composant `OnboardingTour` (client, monté dans le layout) lit ce flag via le client
  navigateur au montage :
  - utilisateur non connecté, ou route `/login` / `/signup` → ne rien faire ;
  - flag `true` → ne rien faire ;
  - flag `false` **ou** aucune ligne `profils` → démarrer la visite.
- Fin de visite (dernière étape) ou « Passer » → écrire `onboarding_termine = true` via une
  action serveur `terminerOnboarding()` qui fait un `upsert` sur `profils` (crée la ligne
  si absente). En cas d'échec réseau, la visite se ferme quand même (le flag local évite
  qu'elle se relance dans la session).

## Architecture

### `src/lib/onboarding/etapes.ts` (logique pure, testable)
- Type `Etape = { id: string; page: RegExp; cible: string; titre: string; texte: string;
  placement: 'haut' | 'bas' | 'gauche' | 'droite'; action?: 'recherche' | 'offre' }`.
- Constante `ETAPES: Etape[]` (voir « Parcours »).
- Fonctions pures :
  - `etapeSuivante(index, total)` → `min(index + 1, total - 1)`
  - `etapePrecedente(index)` → `max(index - 1, 0)`
  - `estDerniere(index, total)` → booléen
  - `pageCorrespond(etape, pathname)` → `etape.page.test(pathname)` (l'overlay ne s'affiche
    que si la page courante correspond à l'étape courante ; sinon pause).

### `src/lib/onboarding/actions.ts` (`'use server'`)
- `terminerOnboarding(): Promise<void>` → upsert `{ user_id, onboarding_termine: true }`.
- `reinitialiserOnboarding(): Promise<void>` → upsert `{ user_id, onboarding_termine: false }`
  (utilisé par « Revoir le tutoriel »).

### `src/components/onboarding-tour.tsx` (client, dans le layout)
État : `actif` (booléen), `index` (numéro d'étape), persistés :
- `index` en `localStorage` (`jc_tour_index`) pour survivre aux navigations et reloads ;
- `actif` déduit du flag DB au montage, + relance possible via `localStorage`
  (`jc_tour_relance`) posé par le bouton du profil.

Comportement :
- Au montage : lit le flag ; si visite requise, `actif = true`, `index = 0`.
- À chaque changement de `pathname` ou d'`index` : si `pageCorrespond(etape, pathname)`,
  localise la cible (`document.querySelector(etape.cible)`), la fait défiler à l'écran
  (`scrollIntoView({ behavior: 'smooth', block: 'center' })`), calcule son rectangle et
  affiche le spotlight + la bulle. Sinon, masque l'overlay (pause) en attendant la bonne page.
- Recalcule le rectangle sur `scroll` et `resize` (listeners nettoyés au démontage).
- Boutons de la bulle :
  - **Suivant** : si l'étape courante porte `action: 'recherche'`, appelle l'action de
    lancement de recherche « Diététicien » (voir ci-dessous) puis avance ; si `action:
    'offre'`, navigue vers la première offre visible puis avance ; sinon avance simplement.
    Sur la dernière étape, le bouton devient **Terminer** → `terminerOnboarding()` + ferme.
  - **Précédent** : recule (borné à 0). Ne rejoue pas les actions de navigation (recul
    purement visuel : si la page ne correspond plus, l'overlay se met en pause, ce qui est
    acceptable pour un retour arrière).
  - **Passer** : `terminerOnboarding()` + ferme immédiatement.

Lancement de la recherche « Diététicien » (étape 1) : réutilise l'action existante
`lancerRecherche('Diététicien')` (`src/lib/recherche/actions.ts`), qui collecte et redirige
vers `/recherche/[id]`. La bulle affiche l'overlay de chargement standard pendant la collecte.
Grâce au dédoublonnage déjà en place (une recherche par mots-clés), relancer la visite ne
crée pas de doublon.

Navigation vers la première offre (étape « offre ») : l'overlay lit le premier élément
`[data-offre-id]` présent dans la liste des résultats et navigue vers `/offre/<id>`.
Si aucune offre n'est présente (collecte vide), l'étape « offre » et les suivantes liées à
l'offre sont ignorées et la visite saute directement à l'étape « suivi/compte » (présente
aussi sur la page résultats via le menu compte du layout).

### `src/components/onboarding-spotlight.tsx` (client)
Rendu via `createPortal(document.body)` :
- **Voile + trou** : un `div` positionné en `fixed` sur le rectangle de la cible, avec
  `box-shadow: 0 0 0 9999px rgba(16,20,17,.62)` (assombrit tout sauf la cible) et un halo
  vert (`outline` + `box-shadow` accent). Le déplacement est **fluide** : `transition` sur
  `top/left/width/height` (≈ .45s `cubic-bezier(.4,0,.2,1)`), donc le projecteur glisse d'un
  élément à l'autre.
- **Bulle** soignée : carte blanche arrondie (rayon 18px), ombre douce, petite flèche vers
  la cible, positionnée selon `placement`. Contenu : puce d'icône, titre gras, texte en
  gris, rangée de points de progression (l'actif en accent), et les boutons
  `Précédent` / `Passer` / `Suivant`. Apparition avec un léger fondu + montée.
- Respecte `prefers-reduced-motion` : pas de transition de déplacement ni d'animation
  d'apparition (le projecteur se repositionne instantanément).
- `pointer-events` : le voile capte les clics (empêche l'interaction accidentelle pendant
  l'explication) sauf sur la zone du trou et sur la bulle.

### Cibles ajoutées (attributs `data-tour`, sans autre changement)
| Étape | Fichier | Élément | Attribut |
|---|---|---|---|
| Recherche | `search-bar.tsx` | conteneur de la barre | `data-tour="recherche"` |
| Filtres | `filtres-bar.tsx` | bouton Filtres | `data-tour="filtres"` |
| Liste | `resultats-shell.tsx` | `list-pane` | `data-tour="liste"` |
| Carte | `resultats-shell.tsx` | `map-pane` | `data-tour="carte"` |
| Like | `offre-card.tsx` | bouton coeur | `data-tour="like"` |
| (nav offre) | `offre-card.tsx` | carte | `data-offre-id={offre.id}` |
| Cloche | `cloche-notifs.tsx` | bouton cloche | `data-tour="cloche"` |
| Postuler | `postuler-zone.tsx` | bouton/lien Postuler | `data-tour="postuler"` |
| Candidature IA | `offre-detail.tsx` | bouton « Candidater avec lettre IA » | `data-tour="candidature-ia"` |
| Compte/Suivi | `compte-menu.tsx` | bouton avatar | `data-tour="compte"` |

## Parcours (ETAPES)

1. **Accueil** · cible `[data-tour="recherche"]` · « Commence ici. Tape le métier que tu
   cherches. » · `action: 'recherche'` (Suivant lance la recherche « Diététicien »).
2. **Résultats** · `[data-tour="filtres"]` · « Affine tes résultats : lieu, distance, type
   de contrat. »
3. **Résultats** · `[data-tour="liste"]` · « Toutes les offres trouvées apparaissent ici. »
4. **Résultats** · `[data-tour="carte"]` · « Et sur la carte : clique un pin pour ouvrir une
   offre. »
5. **Résultats** · `[data-tour="like"]` · « Un coup de coeur ? Sauvegarde l'offre pour la
   retrouver plus tard. »
6. **Résultats** · `[data-tour="cloche"]` · « Nouvelles offres et rappels de candidature
   arrivent dans cette cloche. » · `action: 'offre'` (Suivant ouvre la première offre).
7. **Offre** · `[data-tour="postuler"]` · « Postule ici. Au retour, on te demande si c'est
   fait pour remplir ton suivi. »
8. **Offre** · `[data-tour="candidature-ia"]` · « Ou laisse l'IA rédiger un mail + une lettre
   personnalisés à partir de ton CV. »
9. **Offre** · `[data-tour="compte"]` · « Ton profil, tes offres likées et le suivi de tes
   candidatures sont ici. Bonne chasse ! » · Terminer.

`page` (RegExp) par étape : `^/$` (1), `^/recherche/` (2-6), `^/offre/` (7-9).

## Rejouable

- Bouton « Revoir le tutoriel » dans `src/app/profil/page.tsx` (composant client dédié
  `onboarding-rejouer.tsx`) : appelle `reinitialiserOnboarding()`, pose
  `localStorage.jc_tour_relance = '1'`, remet `jc_tour_index = 0`, puis redirige vers `/`.
  Le moteur détecte la relance au montage et démarre la visite.

## Cas limites

- Collecte « Diététicien » vide → étapes offre ignorées (voir moteur), visite toujours
  terminable.
- Utilisateur qui navigue hors du parcours en pleine visite → overlay en pause, reprise
  quand une page correspond à l'étape courante ; « Passer » toujours disponible via un petit
  bouton persistant quand l'overlay est en pause.
- `data-tour` introuvable sur la page attendue (élément pas encore monté) → petit délai +
  nouvelle tentative (jusqu'à ~2 s) avant de passer l'étape en pause.
- SSR/tests (jsdom) : le spotlight échoue silencieusement si `getBoundingClientRect` /
  Leaflet indisponibles.

## Tests

- `etapes.test.ts` : bornes de `etapeSuivante`/`etapePrecedente`, `estDerniere`,
  `pageCorrespond` (chaque RegExp d'étape contre des pathnames valides et invalides).
- Rendu : un test léger de `onboarding-spotlight` (monte avec une cible factice, vérifie le
  titre/texte et la présence des boutons) et un test de `onboarding-tour` (flag `true` →
  rien affiché ; flag `false` → visite démarrée sur l'étape 1) avec les mêmes patrons de
  mock que `cloche-notifs.test.tsx`.

## Contraintes transverses (rappel)

- Réponses en français, jamais de tiret cadratin (`—`).
- Aucune clé secrète exposée au navigateur.
- Respect de `prefers-reduced-motion`.
