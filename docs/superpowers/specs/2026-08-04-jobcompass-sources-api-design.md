# Sources d'offres API (Adzuna + Jooble) · Design

**Goal :** élargir les sources d'offres de JobCompass au-delà de France Travail en activant Adzuna (déjà codé) et en ajoutant Jooble, deux agrégateurs généralistes couvrant la France.

**Architecture :** le collecteur est déjà multi-sources. `collectForRecherche` lance chaque source en parallèle via `Promise.allSettled`, déduplique par `source:source_id`, puis upsert et lie les résultats. On ajoute Jooble comme troisième source, sur le même contrat que les sources existantes. Adzuna n'a besoin d'aucun code, seulement de ses clés en environnement.

**Tech Stack :** TypeScript, Next.js 16, Supabase, `fetch` natif (injectable pour les tests), Vitest.

## Global Constraints

- Jamais de tiret cadratin dans le code, les commentaires ou la doc. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- Les clés `JOOBLE_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` restent **server-side** : lues via `requireEnv`, jamais préfixées `NEXT_PUBLIC_`, jamais exposées au navigateur.
- Chaque fonction réseau prend un `fetch` injectable (`deps.fetchImpl`) pour être testable sans réseau, comme `adzuna.ts` et `geo/adresse.ts`.
- Messages de commit terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Périmètre

Dans le périmètre :
- Activation d'Adzuna (env uniquement, aucun code).
- Module Jooble complet (requête, normalisation, recherche paginée, géocodage des villes).
- Branchement de Jooble dans le collecteur.
- Tests unitaires du module Jooble.

Hors périmètre (chantiers séparés, YAGNI) :
- Déduplication floue cross-source (une même offre présente sur deux boards reste deux entrées, `source_id` différents).
- Le service de scraping Scrapling (sous-projet 2, spec dédiée).

## Composant : `src/lib/collector/jooble.ts`

Calqué sur `adzuna.ts`. Trois fonctions pures et testables.

### API Jooble

- Endpoint : `POST https://jooble.org/api/{JOOBLE_API_KEY}`
- En-tête : `Content-Type: application/json`
- Corps (toutes valeurs en chaîne) : `{ keywords, location?, radius?, page }`
- Réponse : `{ totalCount: number, jobs: Array<{ id, title, location, snippet, salary, company, type, link, updated }> }`

### `buildJoobleRequest(params, mot, page)`

Retourne `{ url: string, body: Record<string, string> }` :
- `url` = `https://jooble.org/api/` + `requireEnv('JOOBLE_API_KEY')`
- `body.keywords` = `mot`
- `body.location` = `params.commune` si présent
- `body.radius` = `String(params.distance)` si présent
- `body.page` = `String(page)`

### `normalizeJoobleOffre(raw)`

Retourne un `NormalizedOffer` :

| Champ | Source | Notes |
|---|---|---|
| `source` | `'jooble'` | constante |
| `source_id` | `String(raw.id)` | |
| `titre` | `raw.title ?? ''` | |
| `entreprise` | `raw.company \|\| null` | |
| `entreprise_logo` | `null` | Jooble n'en fournit pas |
| `description` | `stripHtml(raw.snippet)` ou `null` | snippet contient des balises `<b>` à retirer |
| `contrat` | `raw.type \|\| null` | |
| `salaire` | `raw.salary \|\| null` | déjà une chaîne |
| `latitude` | `null` | rempli à l'étape géocodage |
| `longitude` | `null` | rempli à l'étape géocodage |
| `ville` | `raw.location \|\| null` | |
| `url_postuler` | `raw.link \|\| null` | |
| `email_contact` | `null` | |
| `date_publication` | `raw.updated \|\| null` | |

`stripHtml(s)` : fonction interne qui retire les balises (`s.replace(/<[^>]*>/g, '')`) et rend `null` si vide.

### `searchJooble(params, deps = {})`

`deps` : `{ fetchImpl?: typeof fetch, geocode?: typeof geocodeCommune }`.

1. Pour chaque `mot` de `params.motsCles` : boucler sur les pages à partir de 1.
   - `POST` l'URL avec le corps JSON.
   - Si la réponse n'est pas `ok`, arrêter ce mot-clé (pas d'exception).
   - Normaliser chaque `job`, indexer dans une `Map` par `source_id` (dédup intra-source).
   - Arrêter le mot-clé si `jobs.length === 0`, si la `Map` atteint `MAX_OFFRES` (300), ou si `page` dépasse une borne de sécurité (`MAX_PAGES`, ex. 15).
2. Géocodage : collecter les `ville` distinctes non nulles des offres, appeler `geocode(ville, fetchImpl)` **une fois par ville** (cache `Map<string, {lat,lng}|null>`), puis remplir `latitude`/`longitude` des offres dont la ville a été résolue. Une ville non résolue laisse les coords à `null` (offre en liste, absente de la carte).
3. Retourner `[...map.values()].slice(0, MAX_OFFRES)`.

Constantes : `MAX_OFFRES = 300`, `MAX_PAGES = 15`.

## Branchement : `src/lib/collector/collect.ts`

- Importer `searchJooble`.
- Ajouter `searchJooble?` au type `Deps`.
- Résoudre `const searchJB = deps.searchJooble ?? jbSearch`.
- Ajouter `searchJB(params)` au tableau du `Promise.allSettled`.
- Le reste (dédup, store, link) est inchangé.

## Flux de données

`collectForRecherche` → `Promise.allSettled([searchFT, searchAZ, searchJB])` → chaque source résolue est ajoutée, une source en échec est loggée (`console.error`) sans bloquer → `dedupeOffres` (clé `source:source_id`) → `storeOffres` (upsert `onConflict: 'source,source_id'`) → `linkResultats`. Aucune migration de base : `source='jooble'` cohabite avec `france-travail` et `adzuna`.

## Gestion d'erreurs

- Clé env absente : `requireEnv('JOOBLE_API_KEY')` lève, l'exception est captée par `Promise.allSettled` dans le collecteur, la source est ignorée et loggée. Comportement identique à Adzuna aujourd'hui quand ses clés manquent : rien ne casse, les autres sources remontent leurs offres.
- Réponse HTTP non `ok` : arrêt propre du mot-clé courant, les offres déjà collectées sont conservées.
- Géocodeur en échec sur une ville : coords à `null`, l'offre reste visible en liste.

## Variables d'environnement (server-side)

| Variable | Rôle |
|---|---|
| `ADZUNA_APP_ID` | identifiant application Adzuna |
| `ADZUNA_APP_KEY` | clé application Adzuna |
| `JOOBLE_API_KEY` | clé API Jooble |

À renseigner en local (`.env.local`) et sur Render (Environment).

## Tests · `src/lib/collector/jooble.test.ts`

Mêmes patterns que `adzuna.test.ts`, `fetch` mocké.

1. `buildJoobleRequest` : URL contient la clé, corps `{ keywords, location, radius, page }` correct ; `location`/`radius` absents si non fournis.
2. `normalizeJoobleOffre` : mapping complet ; `snippet` HTML nettoyé ; champs manquants (`company`, `salary`, `type`) → `null` ; `source_id` en chaîne.
3. `searchJooble` :
   - pagination : deux pages puis page vide arrête la boucle ;
   - réponse non `ok` : arrêt sans exception, offres partielles conservées ;
   - géocodage : `geocode` mocké appelé **une seule fois par ville distincte**, coords bien reportées sur les offres correspondantes ;
   - ville non résolue (`geocode` renvoie `null`) : coords restent `null`.
