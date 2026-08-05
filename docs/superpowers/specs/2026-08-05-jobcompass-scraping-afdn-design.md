# Scraping AFDN via Scrapling · Design

**Goal :** collecter les offres d'emploi diététique du site AFDN (qui n'a pas d'API) par scraping HTTP léger, les stocker dans la table `offres` existante, et les faire remonter dans les résultats et la cloche via le pipeline Node existant, filtrées par le lieu de chaque recherche.

**Architecture :** un scraper Python (Scrapling, mode `Fetcher` HTTP sans navigateur) tourne sur un cron GitHub Actions, géocode les villes et upsert dans `offres` (`source='afdn'`) avec la clé service Supabase. Côté Node, le collecteur gagne une "source scrapée" qui lit les offres scrapées récentes depuis `offres`, les filtre par distance à la recherche, et les relie via le `linkResultats` + détection des nouvelles déjà en place. Aucune logique de liaison n'est dupliquée en Python.

**Tech Stack :** Python 3.11 (Scrapling `[fetchers]`, httpx), GitHub Actions (cron), TypeScript / Next.js 16 côté app, Supabase, Vitest + pytest.

## Global Constraints

- Jamais de tiret cadratin dans le code, les commentaires ou la doc. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- `SUPABASE_SERVICE_ROLE_KEY` reste secret : en local `.env.local`, en CI un secret GitHub Actions. Jamais dans le code ni exposé au navigateur.
- Scraping poli : requêtes séquentielles, petite pause entre les pages, `User-Agent` identifiant le projet, plafond de pages.
- Logique métier en fonctions pures testables (parsing, distance) ; les I/O (HTTP, Supabase) en enveloppes fines.
- Messages de commit terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Ne rien pousser sur GitHub tant que non demandé : commits locaux.

## Périmètre

Dans le périmètre :
- Source scrapée côté Node (agnostique du site) + intégration au collecteur + filtrage géo.
- Scraper Python pour **AFDN uniquement**, structuré pour ajouter d'autres sites plus tard.
- Workflow GitHub Actions (cron quotidien).

Hors périmètre (plus tard) :
- StaffSanté, FHF, Jobvitae (nouveaux parseurs Python, le reste ne bouge pas).
- Mode navigateur furtif (aucun site visé ne le nécessite ici).
- Déduplication floue cross-source.

## Partie A · Intégration Node (source scrapée)

### `src/lib/collector/geo-distance.ts` (créé)

`distanceKm(a: {lat: number, lng: number}, b: {lat: number, lng: number}): number` : distance haversine en kilomètres. Fonction pure.

### `src/lib/collector/scrape-source.ts` (créé)

Constantes : `SOURCES_SCRAPEES = ['afdn']`, `FRAICHEUR_JOURS = 14`.

`offresScrapeesPour(client, recherche, deps?)` :
- `deps` : `{ geocode?: typeof geocodeCommune }`.
- Lit `offres` : `select('id, source, source_id, latitude, longitude').in('source', SOURCES_SCRAPEES).gt('date_collecte', maintenant - 14 j)`.
- Si `recherche.localisation` et `recherche.rayon_km` sont présents : géocode la localisation (via `geocode`), puis ne garde que les offres dont la distance au centre est `<= rayon_km`. Une offre sans coordonnées est **conservée** (on ne masque pas une offre potentiellement pertinente). Si le géocodage échoue, on renvoie toutes les offres récentes (pas de filtre).
- Sans localisation ou sans rayon : renvoie toutes les offres scrapées récentes.
- Retourne `StoredOffre[]` (`{ id, source, source_id }`), forme déjà utilisée par `linkResultats`.

Cette source **ne passe pas** par `storeOffres` : les offres scrapées sont déjà écrites par Python, on ne réécrit pas leur `date_collecte` (sinon une offre délistée ne vieillirait jamais et échapperait à la purge).

### `src/lib/collector/collect.ts` (modifié)

Après `const stored = await storeOffres(...)` :

```ts
const scrapees = await offresScrapees(client, recherche)
await linkResultats(client, recherche.id, [...stored, ...scrapees])
return { collected: offres.length, linked: stored.length + scrapees.length }
```

`offresScrapees` est injectable via `deps` (défaut : `offresScrapeesPour`), comme les autres dépendances. Les offres scrapées nouvellement reliées apparaissent dans le diff `avant/apres` de `rafraichirRecherche`, donc elles alimentent la cloche exactement comme les autres.

## Partie B · Scraper Python (`scraper/`)

Structure :

```
scraper/
  requirements.txt        scrapling[fetchers], httpx
  run.py                  orchestrateur : scrape -> géocode -> upsert
  geocode.py              géocodage ville -> coords (api-adresse.data.gouv.fr)
  supabase_rest.py        upsert dans offres via PostgREST
  sources/
    afdn.py               fetch + parse des offres AFDN
  tests/
    test_afdn.py          parsing sur un fragment HTML de référence
```

### `sources/afdn.py`

- `parse_afdn(html: str) -> list[dict]` : fonction **pure** qui extrait les offres d'une page (sélecteurs CSS déterminés en inspectant le HTML réel d'AFDN lors de l'implémentation). Chaque offre est un dict avec les clés des colonnes `offres` : `source='afdn'`, `source_id`, `titre`, `entreprise`, `description`, `contrat`, `salaire`, `ville`, `url_postuler`, `email_contact`, `date_publication`. `source_id` = identifiant stable de l'offre AFDN (id ou slug d'URL).
- `scrape_afdn(fetch) -> list[dict]` : parcourt les pages via Scrapling `Fetcher` (pagination AFDN, plafond de pages), agrège les offres, dédoublonne par `source_id`. `fetch` injectable pour les tests.

### `geocode.py`

- `geocode_ville(ville: str, client_http) -> tuple[float, float] | None` : appelle `https://api-adresse.data.gouv.fr/search/?q=...&type=municipality&limit=1`, renvoie `(lat, lng)` ou `None`. Cache par ville dans l'appelant.

### `supabase_rest.py`

- `upsert_offres(rows: list[dict], url: str, service_key: str, client_http) -> int` : `POST {url}/rest/v1/offres?on_conflict=source,source_id` avec en-têtes `apikey`, `Authorization: Bearer <service_key>`, `Prefer: resolution=merge-duplicates`, corps JSON. Retourne le nombre de lignes. Ne pose jamais `created_by` (offres lisibles par tous, hors 'manuelle').

### `run.py`

1. Scrape AFDN (`scrape_afdn`).
2. Géocode les villes distinctes, remplit `latitude`/`longitude`.
3. Upsert dans `offres`.
4. Log un résumé (`N offres AFDN upsertées`). Sortie non nulle si une étape lève, pour que GitHub Actions marque l'échec.

Variables d'environnement lues : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Partie C · GitHub Actions (`.github/workflows/scrape.yml`)

- Déclencheurs : `schedule` (cron quotidien, ex. `0 6 * * *`) et `workflow_dispatch` (lancement manuel).
- Étapes : checkout, `setup-python@v5` (3.11), `pip install -r scraper/requirements.txt`, `python -m scraper.run`.
- Secrets injectés en env : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Settings → Secrets and variables → Actions).
- Pas de `scrapling install` : le mode `Fetcher` HTTP ne nécessite pas de navigateur.

## Flux de données

GitHub Actions (cron) → scraper Python scrape AFDN, géocode, upsert dans `offres` (`source='afdn'`). Plus tard, le cron `/api/refresh` (côté app) collecte les sources API, et pour chaque recherche `offresScrapeesPour` lit les offres AFDN récentes, les filtre par distance, et `linkResultats` les relie. Le diff des résultats déclenche la détection des nouvelles → cloche et emails. La purge supprime les offres AFDN délistées après 30 jours (Python cesse de les upserter, leur `date_collecte` fige).

## Gestion d'erreurs

- Scraper : une page en échec (HTTP non ok) arrête la pagination sans planter le reste ; une exception dans `run.py` fait échouer le job (visible dans GitHub Actions).
- Géocodage en échec sur une ville : coords à `None`, l'offre est stockée sans coordonnées (visible en liste, filtrée prudemment côté Node).
- Node : `offresScrapeesPour` en échec est isolé du reste (les offres API sont déjà reliées) ; on log et on continue.

## Tests

Node :
- `distanceKm` : distance connue entre deux villes (ordre de grandeur) ; distance nulle pour un même point.
- `offresScrapeesPour` : sans localisation renvoie tout ; avec localisation filtre par rayon (offre proche gardée, offre lointaine exclue, offre sans coords gardée) ; géocodage nul renvoie tout.
- `collect.ts` : les offres scrapées sont ajoutées à `linkResultats` et comptées dans `linked` (mock d'`offresScrapees`).

Python (pytest) :
- `parse_afdn` : sur un fragment HTML de référence sauvegardé, extrait le bon nombre d'offres et les champs attendus (titre, ville, url, source_id).
- `upsert_offres` : construit la bonne URL, les bons en-têtes et le bon corps (client HTTP mocké).
