# JobCompass · MVP Brique 3 : l'Interface · Design

> Spec de conception. Brique 3 du MVP JobCompass. Prérequis : Brique 1 (Fondations) et Brique 2 (Collecteur) mergées sur `main`.

## 1. Objectif

Rendre visibles et navigables les offres de diététique collectées : une page d'accueil type moteur de recherche, puis un écran de résultats en split façon Airbnb (liste + carte), avec un panneau de détail par offre. C'est la première brique où l'utilisateur voit réellement les offres.

Hors périmètre de cette brique : la génération d'email et de lettre de motivation (Brique 4), le suivi des candidatures, le marché caché.

## 2. Parcours utilisateur

1. **Connexion** (déjà en place, Brique 1).
2. **Accueil recherche** (`/`) : page épurée, logo, titre "Quel poste recherchez-vous ?", une seule barre de recherche centrée. L'utilisateur tape un poste (ex. « diététicien ») et valide.
3. **Chargement** : transition douce (la barre remonte, un skeleton de cartes apparaît) pendant la collecte France Travail. Jamais d'écran blanc.
4. **Résultats** (`/recherche/[id]`) : split façon Airbnb (liste + carte), offres triées par date. L'utilisateur affine (lieu, rayon, contrat), ouvre une offre en panneau de détail, et clique « Postuler » pour ouvrir l'offre d'origine.

La **première recherche se fait sur la France entière** (pas de lieu). L'utilisateur affine ensuite avec le champ Lieu, qui relance une collecte ciblée.

## 3. Écrans

### 3.1 Accueil (`/`)

- Fond épuré, logo « Job**Compass** » (le suffixe en vert accent), grand titre « Quel poste recherchez-vous ? ».
- Une barre de recherche unique, centrée, arrondie, avec ombre douce. Bouton « Rechercher ».
- À la validation : appel de la Server Action `lancerRecherche(poste)`, puis redirection vers `/recherche/[id]`.
- État de chargement : la barre se verrouille, un indicateur discret s'affiche, la transition mène à l'écran résultats.

### 3.2 Résultats (`/recherche/[id]`)

**Barre supérieure** (composant `FiltresBar`) :
- Le poste recherché, éditable (relance une recherche).
- Champ **Lieu** (saisie ville) + sélecteur de **rayon** (ex. 10 / 25 / 50 / 100 km).
- Filtre **type de contrat** (CDI, CDD, etc.), en tri client instantané.
- Compteur d'offres.
- Bouton pour **replier / déplier** le volet liste.

**Split principal** (composant `ResultatsShell`) :
- **Volet gauche** : `OffreListe` (cartes `OffreCard`), triées par `date_publication` décroissante, repliable pour laisser la carte en plein écran.
- **Volet droit** : `CarteOffres` (Leaflet + OpenStreetMap), une épingle par offre localisable.
- **Responsive** : sur mobile, bascule en onglets Liste / Carte.

**Carte d'offre** (`OffreCard`) : titre du poste · employeur + ville · étiquettes (contrat, salaire, date de publication). Survol : la carte se surélève (ombre) et met en évidence l'épingle correspondante sur la carte.

**Panneau de détail** (`OffrePanel`) : au clic sur une carte ou une épingle, un panneau glisse depuis la droite : titre, employeur, ville, contrat, salaire, description complète, et un bouton **Postuler** qui ouvre `url_postuler` dans un nouvel onglet. Un emplacement est réservé (visuellement prévu, non fonctionnel) pour le futur bouton « Candidater avec lettre IA » (Brique 4).

## 4. Comportement des filtres

| Filtre | Effet | Mécanisme |
| --- | --- | --- |
| Poste | Relance une recherche complète | Server Action `lancerRecherche` (nouvelle collecte) |
| Lieu + rayon | Relance une collecte ciblée | Server Action `affinerLieu` (géocodage + collecte) |
| Type de contrat | Tri instantané des offres déjà chargées | Filtre côté client, aucun rechargement |

Le tri par défaut et unique est **par date de publication décroissante** (le scoring IA a été retiré en Brique 2).

## 5. Flux de données et architecture

```
Accueil (client) ──▶ Server Action lancerRecherche(poste)
                         │  1. vérifie la session utilisateur (client serveur Supabase)
                         │  2. upsert recherches (user_id, intitule=poste, mots_cles=[poste], localisation=null)
                         │  3. collectForRecherche(serviceClient, rechercheId)   ← côté serveur, pas de COLLECT_SECRET
                         └▶ redirect /recherche/[id]

/recherche/[id] (serveur) ──▶ lit resultats ⋈ offres (RLS user), triées par date_publication desc
                          └▶ rend ResultatsShell (client) avec les offres

FiltresBar Lieu ──▶ Server Action affinerLieu(id, ville, rayon)
                         │  1. géocode ville via api-adresse.data.gouv.fr → code INSEE + coords
                         │  2. update recherches.localisation (INSEE) + rayon_km
                         │  3. collectForRecherche(serviceClient, id)
                         └▶ revalidate /recherche/[id]
```

- Les Server Actions utilisent le **client serveur** pour l'authentification et le **client service** (`getServiceClient`) pour la collecte (bypass RLS, comme le collecteur). L'action est protégée par la **session utilisateur**, pas par `COLLECT_SECRET`.
- La route `POST /api/collect` (Brique 2) reste en place pour le futur cron.
- Réutilisation directe de `collectForRecherche` (Brique 2) sans modification.

## 6. Géolocalisation des épingles

Priorité de positionnement d'une épingle pour une offre :
1. `latitude` / `longitude` de l'offre si présentes.
2. Sinon, **repli département → préfecture** : on lit le code département depuis le libellé `ville` (format France Travail fréquent « 44 - NANTES ») ou le code postal ; on place l'épingle sur les coordonnées de la préfecture de ce département, via une table statique `département → coords` (`src/lib/geo/departements.ts`, 101 entrées, sans appel réseau).
3. Sinon : l'offre reste dans la liste mais n'apparaît pas sur la carte.

Le géocodage du **champ Lieu** (saisie utilisateur) utilise l'API gratuite `api-adresse.data.gouv.fr` (retour : code INSEE `citycode` + coordonnées), sans clé.

## 7. Composants et fichiers

**Écrans**
- `src/app/page.tsx` : accueil recherche (remplace le placeholder actuel).
- `src/app/recherche/[id]/page.tsx` : écran résultats (composant serveur).

**Composants** (`src/components/`)
- `search-bar.tsx` : barre de recherche de l'accueil (client).
- `resultats-shell.tsx` : layout split, état replié/déplié, coordination survol liste ↔ carte (client).
- `filtres-bar.tsx` : poste, lieu, rayon, contrat, compteur, bouton repli.
- `offre-liste.tsx` + `offre-card.tsx` : liste et carte d'offre.
- `carte-offres.tsx` : carte Leaflet (import dynamique `ssr: false`).
- `offre-panel.tsx` : panneau de détail + Postuler.

**Logique** (`src/lib/`)
- `recherche/actions.ts` : Server Actions `lancerRecherche`, `affinerLieu`.
- `recherche/offres.ts` : lecture des offres d'une recherche (jointure `resultats ⋈ offres`, tri date).
- `geo/adresse.ts` : géocodage ville → INSEE + coords (API adresse gouv).
- `geo/departements.ts` : table statique département → coords préfecture + `positionEpingle(offre)`.

## 8. Direction visuelle

- **Typographie** : Montserrat, plusieurs graisses (logo bold, titres semi-bold, méta regular, dates en italique léger). Déjà chargée (Brique 1).
- **Couleurs** : accent vert `#2e9e5b` (variable `--accent`), `--accent-soft` pour les fonds, arrondis généreux (`rounded-xl` / `rounded-2xl`), ombres douces.
- **Animations** : fondu d'apparition des cartes, glissement du volet au repli, glissement du panneau de détail, survol qui surélève la carte et met en évidence l'épingle.
- **Librairies** : sobre par défaut, Tailwind + transitions CSS pour l'essentiel. Une brique d'animation externe (ex. anime.js, ou un composant copié depuis reactbits / magicui) uniquement si un effet précis le justifie, jamais en accumulation. Pas de dépendance UI lourde non justifiée.

## 9. Gestion des erreurs et cas limites

- **Aucune offre** : état vide explicite (« Aucune offre pour cette recherche », suggestion d'élargir le lieu ou le rayon), pas de carte vide anxiogène.
- **Collecte en échec** (source indisponible) : message non bloquant, les offres déjà en base restent affichées.
- **Ville non géocodable** : message « Lieu introuvable, précisez la commune », la recherche précédente reste affichée.
- **Offre sans coordonnées ni département** : présente en liste, absente de la carte (jamais de plantage de la carte).
- **Recherche inexistante ou d'un autre utilisateur** (`/recherche/[id]`) : 404 (RLS + garde applicative).

## 10. Tests (Vitest)

Prioritaires :
- **Géocodage** (`geo/adresse.ts`) : fetch mocké → extraction INSEE + coords ; cas « lieu introuvable ».
- **Repli d'épingle** (`geo/departements.ts`) : offre avec coords → coords ; offre « 44 - NANTES » sans coords → préfecture 44 ; offre sans info → pas d'épingle.
- **Server Action `lancerRecherche`** : poste → ligne `recherches` correcte (mots_cles, localisation nulle), appel de la collecte.
- **Lecture des offres** (`recherche/offres.ts`) : tri par `date_publication` décroissante, offres nulles en date en fin de liste.
- **Filtre contrat client** : sous-ensemble correct selon le type sélectionné.
- **Rendu composants** : `OffreCard` (champs affichés), `OffreListe` (état vide), `OffrePanel` (bouton Postuler pointe sur `url_postuler`).

La carte Leaflet elle-même (rendu DOM cartographique) n'est pas testée unitairement ; sa logique de données (`positionEpingle`) l'est.

## 11. Découpage en tâches (pour le plan)

1. Lecture des offres d'une recherche (`recherche/offres.ts`) + tests de tri.
2. Géocodage ville (`geo/adresse.ts`) + table préfectures et `positionEpingle` (`geo/departements.ts`) + tests.
3. Server Actions `lancerRecherche` et `affinerLieu` (`recherche/actions.ts`) + tests.
4. Accueil recherche (`page.tsx` + `search-bar.tsx`).
5. Écran résultats : `ResultatsShell` + `FiltresBar` + repli/déplié.
6. Liste : `OffreListe` + `OffreCard` (tri date, filtre contrat client, survol).
7. Carte : `CarteOffres` (Leaflet, import dynamique) + coordination survol liste ↔ carte.
8. Panneau de détail `OffrePanel` (détail + Postuler + emplacement futur bouton IA).
9. États limites (vide, erreur, mobile onglets) + finitions animations.
