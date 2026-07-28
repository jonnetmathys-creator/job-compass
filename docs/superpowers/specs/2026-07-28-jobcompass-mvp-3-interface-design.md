# JobCompass · MVP Brique 3 : l'Interface · Design

> Spec de conception. Brique 3 du MVP JobCompass. Prérequis : Brique 1 (Fondations) et Brique 2 (Collecteur) mergées sur `main`.
> Référence visuelle validée : `docs/superpowers/specs/mockups/interface-mockup.html` (maquette interactive : accueil, résultats, page offre, profil). Les sous-agents doivent reproduire son rendu et ses interactions.

## 1. Objectif

Rendre visibles et navigables les offres de diététique collectées : une page d'accueil type moteur de recherche, un écran de résultats en split façon Airbnb (liste + carte), une page dédiée par offre, un système de favoris (like), et un espace compte. C'est la première brique où l'utilisateur voit et manipule réellement les offres.

Hors périmètre : la génération d'email et de lettre de motivation (Brique 4), le suivi des candidatures, le marché caché. Le bouton « Candidater avec lettre IA » est présent mais désactivé (placeholder « bientôt »).

## 2. Parcours utilisateur

1. **Connexion** (déjà en place, Brique 1).
2. **Accueil recherche** (`/`) : page épurée et animée, logo, un titre vivant, une seule barre de recherche. L'utilisateur tape un poste (ex. « diététicien ») et valide. La **première recherche couvre toute la France** (pas de lieu).
3. **Chargement** : transition douce (skeleton de cartes) pendant la collecte France Travail. Jamais d'écran blanc.
4. **Résultats** (`/recherche/[id]`) : split liste + carte, offres triées par date. L'utilisateur affine (lieu, rayon, contrat), déroule une offre pour un aperçu, ou ouvre sa **page dédiée**.
5. **Page offre** (`/offre/[id]`) : toutes les infos + Postuler + like.
6. **Profil** (`/profil`) : infos utilisateur + liste des **offres likées**. Accessible via l'espace compte.

## 3. Écrans et composants

### 3.1 Accueil (`/`)

- Fond épuré avec **éléments vectorisés animés subtils** (formes douces vertes qui dérivent, anneaux, motif compas en rotation lente, trame de points), en faible opacité.
- Logo « Job**Compass** » (suffixe en vert).
- **Titre vivant** : plusieurs formulations qui se succèdent (« Quel *poste* recherchez-vous ? », « Quelle sera votre prochaine *mission* ? », etc.), animées **mot par mot en slide-up + défloutage** (sortie des mots vers le haut, entrée chevauchant légèrement la sortie pour éviter tout à-coup). Un seul mot clé par phrase est mis en avant en **vert + italique**.
- Barre de recherche unique, centrée, arrondie, avec **placeholder animé** (métiers qui s'écrivent/s'effacent en boucle) et bouton « Rechercher ».
- À la validation : Server Action `lancerRecherche(poste)` puis redirection vers `/recherche/[id]`.

### 3.2 Résultats (`/recherche/[id]`)

**Barre supérieure** (`FiltresBar`) : poste éditable (pastille verte), champ **Lieu**, sélecteur de **rayon** (défaut « France entière »), filtre **type de contrat**. Le logo à gauche.

**Split principal** (`ResultatsShell`) :
- **Volet gauche** : `OffreListe` (cartes `OffreCard`), triées par `date_publication` décroissante.
- **Volet droit** : `CarteOffres` (Leaflet + OpenStreetMap/CARTO).
- **Bouton de repli flottant** : posé sur la carte (bord gauche, centré verticalement), rond blanc à ombre douce, chevron qui pivote. Le repli fait **glisser** la liste hors champ et la carte s'agrandit **de façon fluide** (redimensionnement image par image, pas de saut).
- **Responsive** : bascule en onglets Liste / Carte sur mobile.

**Carte d'offre** (`OffreCard`) : titre · employeur + ville · étiquettes (contrat, salaire en vert, date en italique) · **cœur de like** en haut à droite. Survol : la carte se surélève et met en évidence l'épingle correspondante. **Clic** : l'offre **se déroule en accordéon** (une seule ouverte) et affiche un **aperçu** de la description + un bouton **En savoir plus**.

**Carte Leaflet** (`CarteOffres`) :
- Épingles **stylisées en goutte verte** (pas de texte sur l'épingle). Survol synchronisé liste ↔ épingle.
- **Regroupement** (clustering) : quand plusieurs offres sont proches et la carte dézoomée, elles se réunissent en un **cercle vert avec le nombre** d'offres ; au zoom, elles se re-dispatchent.
- **Clic sur une épingle** : ouvre une **mini-preview cliquable** (titre, employeur, salaire, lien « Voir l'offre → ») qui mène à la page offre, et déroule l'offre correspondante dans la liste à gauche (en défilant jusqu'à elle, en rouvrant la liste si repliée).

### 3.3 Page offre (`/offre/[id]`)

En-tête sur bandeau à dégradé doux : étiquettes, **avatar employeur** (logo France Travail si disponible, sinon initiale colorée en repli), titre, employeur · ville. Corps en deux colonnes : description complète et profil recherché à gauche ; encart récapitulatif à droite (contrat, lieu, salaire en vert, date, chacun avec une icône), mini-carte de localisation, bouton **Sauvegarder l'offre** (like), bouton **Postuler** (ouvre `url_postuler` dans un nouvel onglet), et le placeholder **Candidater avec lettre IA · bientôt**. Bouton retour vers les résultats.

### 3.4 Espace compte (global, haut droite)

Avatar cliquable présent sur toutes les pages, ouvrant un **menu déroulant** : en-tête (nom + email), **Mon profil**, **Mes offres likées** (avec compteur), **Paramètres du compte**, **Déconnexion**. Fermeture au clic extérieur.

### 3.5 Profil (`/profil`)

En-tête utilisateur (avatar, nom, email) puis section **Mes offres likées** : grille de cartes d'offres likées (chaque carte cliquable vers sa page offre, cœur pour retirer), avec un **état vide** explicite quand aucune offre n'est likée. Réutilise/complète la page profil existante (Brique 1 : infos + CV + lettre de base).

## 4. Comportement des filtres et du tri

| Filtre | Effet | Mécanisme |
| --- | --- | --- |
| Poste | Relance une recherche complète | Server Action `lancerRecherche` |
| Lieu + rayon | Relance une collecte ciblée | Server Action `affinerLieu` (géocodage + collecte) |
| Type de contrat | Tri instantané des offres chargées | Filtre côté client, aucun rechargement |

Tri par défaut et unique : **par date de publication décroissante** (le scoring IA a été retiré en Brique 2). Rayon par défaut : **France entière** (aucun km imposé tant qu'aucun lieu n'est saisi).

## 5. Flux de données et Server Actions

```
Accueil ──▶ lancerRecherche(poste)
              1. vérifie la session (client serveur Supabase)
              2. upsert recherches (user_id, intitule=poste, mots_cles=[poste], localisation=null)
              3. collectForRecherche(serviceClient, id)   ← serveur, pas de COLLECT_SECRET
            ──▶ redirect /recherche/[id]

/recherche/[id] (serveur) ──▶ lit resultats ⋈ offres (RLS user), triées par date_publication desc
                          ──▶ rend ResultatsShell (client)

FiltresBar Lieu ──▶ affinerLieu(id, ville, rayon)
                      1. géocode ville via api-adresse.data.gouv.fr → code INSEE + coords
                      2. update recherches.localisation (INSEE) + rayon_km
                      3. collectForRecherche(serviceClient, id) ; revalidate

Like ──▶ toggleFavori(offre_id)  (Server Action, session user)
          insert/delete favoris (user_id, offre_id)
/profil (serveur) ──▶ lit favoris ⋈ offres (RLS user)
```

- Server Actions protégées par la **session utilisateur**. Collecte via le **client service** (bypass RLS, comme le collecteur). Réutilise `collectForRecherche` (Brique 2) sans modification.
- La route `POST /api/collect` (Brique 2) reste en place pour le futur cron.

## 6. Ajouts au modèle de données

- **Table `favoris`** : `user_id`, `offre_id`, `date`. Clé unique (user_id, offre_id). RLS : chacun ne voit que ses favoris. (offres restent mutualisées.)
- **Colonne `offres.entreprise_logo`** (texte, nullable) : URL du logo employeur. Le normaliseur France Travail (Brique 2) doit capter `raw.entreprise?.logo`. Affiché dans l'avatar de la page offre, avec repli sur l'initiale.
- Migration SQL dédiée dans `supabase/migrations/`.

## 7. Géolocalisation des épingles

Priorité de positionnement d'une épingle :
1. `latitude` / `longitude` de l'offre si présentes.
2. Sinon **repli département → préfecture** : lecture du code département depuis le libellé `ville` (format « 44 - NANTES ») ou le code postal ; épingle placée sur la préfecture via une table statique `département → coords` (`src/lib/geo/departements.ts`, sans réseau).
3. Sinon : offre en liste mais absente de la carte.

Géocodage du champ **Lieu** (saisie) via `api-adresse.data.gouv.fr` (retour `citycode` INSEE + coords), sans clé.

## 8. Fichiers

**Écrans** : `src/app/page.tsx` (accueil), `src/app/recherche/[id]/page.tsx` (résultats), `src/app/offre/[id]/page.tsx` (page offre), `src/app/profil/page.tsx` (étendre : ajouter les offres likées).

**Composants** (`src/components/`) : `search-bar.tsx` (accueil, titre + placeholder animés), `resultats-shell.tsx` (split + repli fluide), `filtres-bar.tsx`, `offre-liste.tsx`, `offre-card.tsx` (accordéon + like), `carte-offres.tsx` (Leaflet + clustering + mini-preview), `compte-menu.tsx` (espace compte global), `like-bouton.tsx` (cœur + animation pop).

**Logique** (`src/lib/`) : `recherche/actions.ts` (`lancerRecherche`, `affinerLieu`), `recherche/offres.ts` (lecture triée), `favoris/actions.ts` (`toggleFavori`) + `favoris/lecture.ts`, `geo/adresse.ts`, `geo/departements.ts`.

**Dépendances** : `leaflet`, `react-leaflet` (ou intégration Leaflet directe), `leaflet.markercluster` (ou `react-leaflet-cluster`). Animations : Tailwind + CSS d'abord ; une brique externe (ex. anime.js) seulement si un effet le justifie.

## 9. Direction visuelle

- Montserrat multi-graisses (logo 800, titres 700/800, méta regular, dates italique, mot clé accent en italique). Déjà chargée (Brique 1) ; ajouter les graisses italiques nécessaires.
- Accent vert `#2e9e5b`, `--accent-soft`, arrondis généreux (`rounded-xl`/`2xl`), ombres douces.
- Animations : titre mot par mot (slide-up + blur), placeholder machine à écrire, fond vectorisé en dérive lente, fondu des cartes, survol qui surélève, glissement fluide du volet, déroulé accordéon, pop + onde au like.
- Cœur de like en rouge doux (`#e2565b`) ; le reste de l'UI en vert.

## 10. Gestion des erreurs et cas limites

- **Aucune offre** : état vide explicite (suggestion d'élargir lieu/rayon).
- **Collecte en échec** : message non bloquant, offres déjà en base affichées.
- **Ville non géocodable** : message « Lieu introuvable », recherche précédente conservée.
- **Offre sans coords ni département** : en liste, absente de la carte.
- **Logo employeur indisponible ou cassé** : repli automatique sur l'initiale.
- **Recherche/offre inexistante ou d'un autre utilisateur** : 404 (RLS + garde applicative).
- **Aucune offre likée** : état vide dédié dans le profil.

## 11. Tests (Vitest)

- **Géocodage** (`geo/adresse.ts`) : fetch mocké → INSEE + coords ; cas introuvable.
- **Repli d'épingle** (`geo/departements.ts`) : coords présentes → coords ; « 44 - NANTES » sans coords → préfecture 44 ; sans info → pas d'épingle.
- **Server Action `lancerRecherche`** : poste → ligne `recherches` correcte (localisation nulle), collecte appelée.
- **Lecture offres** (`recherche/offres.ts`) : tri par `date_publication` desc, dates nulles en fin.
- **Filtre contrat client** : sous-ensemble correct.
- **Favoris** (`favoris/actions.ts`) : toggle insère/supprime ; lecture ne renvoie que les favoris de l'utilisateur.
- **Composants** : `OffreCard` (champs, cœur, accordéon), `OffreListe` (état vide), avatar page offre (logo si présent sinon initiale), profil (liste likée + état vide).

Le rendu cartographique Leaflet et les animations ne sont pas testés unitairement ; leur logique de données (`positionEpingle`, tri, favoris) l'est.

## 12. Découpage en tâches (pour le plan)

1. Migration : table `favoris` + colonne `offres.entreprise_logo` ; capter le logo dans le normaliseur France Travail.
2. Lecture des offres d'une recherche (`recherche/offres.ts`) + tests de tri.
3. Géocodage ville (`geo/adresse.ts`) + table préfectures et `positionEpingle` (`geo/departements.ts`) + tests.
4. Server Actions `lancerRecherche` / `affinerLieu` + `favoris/actions.ts` + lecture favoris + tests.
5. Accueil (`page.tsx` + `search-bar.tsx`) : titre animé, placeholder animé, fond vectorisé.
6. Écran résultats : `ResultatsShell` + `FiltresBar` + repli fluide flottant.
7. Liste : `OffreListe` + `OffreCard` (tri date, filtre contrat client, survol, accordéon, cœur de like + animation).
8. Carte : `CarteOffres` (Leaflet, clustering, épingles stylisées, mini-preview cliquable, synchro survol).
9. Page offre (`/offre/[id]`) : en-tête + avatar logo/initiale, encart récap, mini-carte, Postuler, like, placeholder IA.
10. Espace compte (`compte-menu.tsx`) + profil étendu (offres likées + état vide).
11. États limites (vide, erreur, mobile onglets) + finitions animations.
