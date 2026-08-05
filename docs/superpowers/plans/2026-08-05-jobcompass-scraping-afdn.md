# Scraping AFDN via Scrapling · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** scraper les offres AFDN et les faire remonter dans les résultats et la cloche via le pipeline Node, filtrées par le lieu de la recherche.

**Architecture :** côté Node, une "source scrapée" lit les offres AFDN récentes depuis `offres`, les filtre par distance et les relie via `linkResultats`. Côté Python, un scraper Scrapling (HTTP) récupère `https://www.afdn.org/emploi?items_per_page=All`, parse les 43 offres, géocode, et upsert dans `offres`. Un cron GitHub Actions lance le scraper chaque jour.

**Tech Stack :** TypeScript / Next.js 16 / Vitest ; Python 3.11 (Scrapling `[fetchers]`, httpx) / pytest ; GitHub Actions.

## Global Constraints

- Jamais de tiret cadratin. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- `SUPABASE_SERVICE_ROLE_KEY` : secret, jamais dans le code ni exposé au navigateur.
- Scraping poli : en-têtes navigateur, une requête, `User-Agent` identifiant le projet.
- Logique métier en fonctions pures testables ; I/O en enveloppes fines.
- Commits terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commits locaux uniquement.

## Faits établis (inspection du HTML réel)

- URL unique : `https://www.afdn.org/emploi?items_per_page=All` (43 offres, sans pagination). En-têtes navigateur requis (403 sinon).
- Chaque offre : `<article about="/offre/<slug>" class="node--type-offre">`.
- Titre : `span.field--name-title` (texte).
- Description : `.field--name-field-description .field__item` (HTML avec `<br />`) ; sa 2ᵉ ligne porte le lieu, ex. `44 - REZE (44400)`.
- `source_id` = slug (après `/offre/`). `url_postuler` = `https://www.afdn.org` + `about`.

## File Structure

- `src/lib/collector/geo-distance.ts` (créé) : `distanceKm`.
- `src/lib/collector/scrape-source.ts` (créé) : `offresScrapeesPour`.
- `src/lib/collector/collect.ts` (modifié) : liaison des offres scrapées.
- `scraper/` (créé) : `requirements.txt`, `run.py`, `geocode.py`, `supabase_rest.py`, `sources/afdn.py`, `tests/`.
- `.github/workflows/scrape.yml` (créé).

---

### Task 1: Distance haversine (Node)

**Files:**
- Create: `src/lib/collector/geo-distance.ts`
- Test: `src/lib/collector/geo-distance.test.ts`

**Interfaces:**
- Produces : `distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number`.

- [ ] **Step 1: Test (échoue d'abord)**

```ts
import { expect, test } from 'vitest'
import { distanceKm } from './geo-distance'

test('distanceKm vaut 0 pour un même point', () => {
  expect(distanceKm({ lat: 47.2, lng: -1.55 }, { lat: 47.2, lng: -1.55 })).toBe(0)
})

test('distanceKm Nantes-Rennes est de l’ordre de 100 km', () => {
  const d = distanceKm({ lat: 47.218, lng: -1.554 }, { lat: 48.117, lng: -1.677 })
  expect(d).toBeGreaterThan(95)
  expect(d).toBeLessThan(115)
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/collector/geo-distance.test.ts`
Expected: FAIL (module absent).

- [ ] **Step 3: Implémenter**

```ts
// Distance haversine en kilomètres entre deux points (lat/lng en degrés).
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run src/lib/collector/geo-distance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collector/geo-distance.ts src/lib/collector/geo-distance.test.ts
git commit -m "feat(collecte): distance haversine (filtrage géo des offres scrapées)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Source scrapée (Node)

**Files:**
- Create: `src/lib/collector/scrape-source.ts`
- Test: `src/lib/collector/scrape-source.test.ts`

**Interfaces:**
- Consumes : `distanceKm` (Task 1) ; `geocodeCommune` depuis `@/lib/geo/adresse` ; `StoredOffre` depuis `./store`.
- Produces : `offresScrapeesPour(client, recherche, deps?) => Promise<StoredOffre[]>` où `recherche` a `{ localisation: string | null; rayon_km: number | null }` et `deps` `{ geocode?: typeof geocodeCommune }`.

- [ ] **Step 1: Tests (échouent d'abord)**

```ts
import { expect, test, vi } from 'vitest'
import { offresScrapeesPour } from './scrape-source'

function clientAvec(rows: any[]) {
  const gt = vi.fn().mockResolvedValue({ data: rows, error: null })
  const inFn = vi.fn(() => ({ gt }))
  const select = vi.fn(() => ({ in: inFn }))
  return { from: vi.fn(() => ({ select })) } as any
}

const NANTES = { insee: '44109', lat: 47.218, lng: -1.554, label: 'Nantes' }

test('sans localisation, renvoie toutes les offres scrapées récentes', async () => {
  const rows = [
    { id: 'a', source: 'afdn', source_id: '1', latitude: 47.2, longitude: -1.5 },
    { id: 'b', source: 'afdn', source_id: '2', latitude: 48.8, longitude: 2.3 },
  ]
  const out = await offresScrapeesPour(clientAvec(rows), { localisation: null, rayon_km: null }, { geocode: vi.fn() as any })
  expect(out.map((o) => o.id)).toEqual(['a', 'b'])
})

test('avec localisation, filtre par rayon et garde les offres sans coords', async () => {
  const rows = [
    { id: 'proche', source: 'afdn', source_id: '1', latitude: 47.25, longitude: -1.5 }, // ~5 km de Nantes
    { id: 'loin', source: 'afdn', source_id: '2', latitude: 48.85, longitude: 2.35 },   // Paris
    { id: 'sanscoords', source: 'afdn', source_id: '3', latitude: null, longitude: null },
  ]
  const geocode = vi.fn().mockResolvedValue(NANTES)
  const out = await offresScrapeesPour(clientAvec(rows), { localisation: 'Nantes', rayon_km: 30 }, { geocode: geocode as any })
  expect(out.map((o) => o.id).sort()).toEqual(['proche', 'sanscoords'])
})

test('si le géocodage échoue, renvoie tout (pas de filtre)', async () => {
  const rows = [{ id: 'a', source: 'afdn', source_id: '1', latitude: 48.8, longitude: 2.3 }]
  const geocode = vi.fn().mockResolvedValue(null)
  const out = await offresScrapeesPour(clientAvec(rows), { localisation: 'zzz', rayon_km: 10 }, { geocode: geocode as any })
  expect(out.map((o) => o.id)).toEqual(['a'])
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/collector/scrape-source.test.ts`
Expected: FAIL (module absent).

- [ ] **Step 3: Implémenter**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { geocodeCommune } from '@/lib/geo/adresse'
import { distanceKm } from './geo-distance'
import type { StoredOffre } from './store'

const SOURCES_SCRAPEES = ['afdn']
const FRAICHEUR_JOURS = 14

type RechercheGeo = { localisation: string | null; rayon_km: number | null }
type Deps = { geocode?: typeof geocodeCommune }
type Ligne = { id: string; source: string; source_id: string; latitude: number | null; longitude: number | null }

export async function offresScrapeesPour(
  client: SupabaseClient, recherche: RechercheGeo, deps: Deps = {},
): Promise<StoredOffre[]> {
  const geocode = deps.geocode ?? geocodeCommune
  const cutoff = new Date(Date.now() - FRAICHEUR_JOURS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await client
    .from('offres')
    .select('id, source, source_id, latitude, longitude')
    .in('source', SOURCES_SCRAPEES)
    .gt('date_collecte', cutoff)
  if (error) throw error
  const lignes = (data ?? []) as Ligne[]

  const stored = (l: Ligne): StoredOffre => ({ id: l.id, source: l.source, source_id: l.source_id })

  // Pas de filtre géo si la recherche n'a ni lieu ni rayon.
  if (!recherche.localisation || recherche.rayon_km == null) return lignes.map(stored)

  const centre = await geocode(recherche.localisation)
  if (!centre) return lignes.map(stored) // géocodage KO : on ne filtre pas

  return lignes
    .filter((l) =>
      l.latitude == null || l.longitude == null || // offre sans coords : conservée
      distanceKm({ lat: centre.lat, lng: centre.lng }, { lat: l.latitude, lng: l.longitude }) <= recherche.rayon_km!)
    .map(stored)
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run src/lib/collector/scrape-source.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collector/scrape-source.ts src/lib/collector/scrape-source.test.ts
git commit -m "feat(collecte): source scrapée (lit les offres AFDN récentes, filtre par lieu)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Liaison des offres scrapées dans le collecteur (Node)

**Files:**
- Modify: `src/lib/collector/collect.ts`
- Test: `src/lib/collector/collect.test.ts`

**Interfaces:**
- Consumes : `offresScrapeesPour` (Task 2).
- Produces : `collectForRecherche` relie aussi les offres scrapées ; `Deps` accepte `offresScrapees?: (client, recherche) => Promise<StoredOffre[]>`.

- [ ] **Step 1: Mettre à jour le test (échoue d'abord)**

Remplacer le premier test de `collect.test.ts` par cette version (ajout d'offres scrapées) et garder le second test tel quel :

```ts
test('collecte les sources, ajoute les offres scrapées, dédoublonne, écrit et relie', async () => {
  const recherche = {
    id: 'rech-1', mots_cles: [], localisation: '44109',
    rayon_km: 30, type_contrat: null,
  }
  const storeOffres = vi.fn().mockResolvedValue([
    { id: 'u1', source: 'france_travail', source_id: '1' },
    { id: 'u2', source: 'adzuna', source_id: '9' },
    { id: 'u3', source: 'jooble', source_id: '5' },
  ])
  const linkResultats = vi.fn().mockResolvedValue(undefined)
  const res = await collectForRecherche({} as any, recherche, {
    searchFranceTravail: vi.fn().mockResolvedValue([o('france_travail', '1')]),
    searchAdzuna: vi.fn().mockResolvedValue([o('adzuna', '9')]),
    searchJooble: vi.fn().mockResolvedValue([o('jooble', '5')]),
    offresScrapees: vi.fn().mockResolvedValue([{ id: 'sc1', source: 'afdn', source_id: 'slug-1' }]),
    storeOffres,
    linkResultats,
  })
  // 3 offres stockées + 1 scrapée reliées
  expect(linkResultats.mock.calls[0][2]).toHaveLength(4)
  expect(res).toMatchObject({ collected: 3, linked: 4 })
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/collector/collect.test.ts`
Expected: FAIL (`linked` vaut 3, pas 4).

- [ ] **Step 3: Modifier `collect.ts`**

Ajouter l'import :

```ts
import { offresScrapeesPour } from './scrape-source'
import type { StoredOffre } from './store'
```

Ajouter au type `Deps` :

```ts
  offresScrapees?: (client: SupabaseClient, recherche: any) => Promise<StoredOffre[]>
```

Résoudre la dépendance (après `const linkResultats = ...`) :

```ts
  const offresScrapees = deps.offresScrapees ?? offresScrapeesPour
```

Remplacer la fin de la fonction (après `const stored = await storeOffres(client, offres)`) par :

```ts
  // Source scrapée isolée : un échec ne remet pas en cause les offres API déjà stockées.
  let scrapees: StoredOffre[] = []
  try { scrapees = await offresScrapees(client, recherche) }
  catch (e) { console.error('[collect] offres scrapées en échec :', e) }
  await linkResultats(client, recherche.id, [...stored, ...scrapees])

  return { collected: offres.length, linked: stored.length + scrapees.length }
```

Le second test de `collect.test.ts` reste valide tel quel : il ne fournit pas `offresScrapees`, la vraie fonction lève sur le client `{}` mocké, l'exception est captée et `scrapees` reste `[]`.

- [ ] **Step 4: Lancer + suite + build**

Run: `npx vitest run src/lib/collector/ && npx next build`
Expected: PASS, build réussi.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collector/collect.ts src/lib/collector/collect.test.ts
git commit -m "feat(collecte): relie les offres scrapées aux recherches (via le pipeline existant)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Parseur AFDN (Python)

**Files:**
- Create: `scraper/sources/afdn.py`, `scraper/sources/__init__.py`, `scraper/__init__.py`
- Create: `scraper/tests/test_afdn.py`, `scraper/tests/fixtures/afdn.html`
- Create: `scraper/requirements.txt`

**Interfaces:**
- Produces : `parse_afdn(html: str) -> list[dict]` (pur) ; `scrape_afdn(fetch=...) -> list[dict]`.

- [ ] **Step 1: Sauver une fixture HTML réelle**

Récupérer une vraie page AFDN et en garder un extrait de 2 offres comme fixture :

```bash
mkdir -p scraper/tests/fixtures
curl -sS "https://www.afdn.org/emploi?items_per_page=All" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" \
  -H "Accept: text/html" -H "Accept-Language: fr-FR,fr;q=0.9" --compressed \
  -o scraper/tests/fixtures/afdn.html
```

- [ ] **Step 2: requirements.txt**

Créer `scraper/requirements.txt` :

```
scrapling[fetchers]
httpx
pytest
```

- [ ] **Step 3: Écrire le test (échoue d'abord)**

Créer `scraper/tests/test_afdn.py` :

```python
from pathlib import Path
from scraper.sources.afdn import parse_afdn

FIXTURE = (Path(__file__).parent / "fixtures" / "afdn.html").read_text(encoding="utf-8")


def test_parse_afdn_extrait_les_offres():
    offres = parse_afdn(FIXTURE)
    assert len(offres) >= 2
    o = offres[0]
    assert o["source"] == "afdn"
    assert o["source_id"]                       # slug non vide
    assert o["titre"]                           # titre non vide
    assert o["url_postuler"].startswith("https://www.afdn.org/offre/")


def test_parse_afdn_deduplique_par_source_id():
    offres = parse_afdn(FIXTURE)
    ids = [o["source_id"] for o in offres]
    assert len(ids) == len(set(ids))
```

- [ ] **Step 4: Lancer, vérifier l'échec**

Run: `python3 -m pytest scraper/tests/test_afdn.py -q`
Expected: FAIL (module absent).

- [ ] **Step 5: Écrire le parseur**

Créer `scraper/sources/afdn.py`. `parse_afdn` construit un `Selector` Scrapling à partir de la chaîne HTML (confirmer le constructeur `Selector(...)` au premier lancement de pytest, ajuster si l'import diffère), sélectionne chaque `article.node--type-offre`, et extrait les champs. `ville` est parsée depuis la description via une regex de code postal.

```python
import re
from scrapling.parser import Selector

BASE = "https://www.afdn.org"
URL = f"{BASE}/emploi?items_per_page=All"
ENTETES = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9",
}

# Cherche un lieu type "44 - REZE (44400)" et en tire "REZE (44400)".
_LIEU = re.compile(r"\d{1,3}\s*-\s*([A-Za-zÀ-ÿ' \-]+?)\s*\((\d{5})\)")


def _texte(el) -> str:
    return (el.text or "").strip() if el is not None else ""


def _ville(description: str) -> str | None:
    m = _LIEU.search(description or "")
    if not m:
        return None
    return f"{m.group(1).strip()} ({m.group(2)})"


def parse_afdn(html: str) -> list[dict]:
    page = Selector(html)
    offres: dict[str, dict] = {}
    for art in page.css("article.node--type-offre"):
        about = art.attrib.get("about", "")
        if not about.startswith("/offre/"):
            continue
        source_id = about[len("/offre/"):]
        titre = _texte(art.css_first("span.field--name-title"))
        desc = _texte(art.css_first(".field--name-field-description .field__item"))
        offres[source_id] = {
            "source": "afdn",
            "source_id": source_id,
            "titre": titre,
            "entreprise": None,
            "description": desc or None,
            "contrat": None,
            "salaire": None,
            "ville": _ville(desc),
            "url_postuler": BASE + about,
            "email_contact": None,
            "date_publication": None,
        }
    return list(offres.values())


def scrape_afdn(fetch) -> list[dict]:
    """`fetch(url, headers) -> objet avec .body (str)` ; injectable pour les tests."""
    reponse = fetch(URL, ENTETES)
    return parse_afdn(reponse)
```

Note : `scrape_afdn` reçoit déjà le HTML (chaîne) via `fetch`. L'adaptateur réel Scrapling `Fetcher` est construit en Task 5 (`run.py`), qui passe une fonction renvoyant `page.html_content` ou l'équivalent confirmé au lancement.

- [ ] **Step 6: Lancer, vérifier le succès**

Run: `python3 -m pytest scraper/tests/test_afdn.py -q`
Expected: PASS. Si le constructeur `Selector` diffère (ex. `Adaptor`), corriger l'import et relancer.

- [ ] **Step 7: Commit**

```bash
git add scraper/
git commit -m "feat(scraper): parseur AFDN (offres depuis le HTML, ville depuis le code postal)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Géocodage, upsert Supabase, orchestrateur (Python)

**Files:**
- Create: `scraper/geocode.py`, `scraper/supabase_rest.py`, `scraper/run.py`
- Test: `scraper/tests/test_supabase_rest.py`

**Interfaces:**
- Produces : `geocode_ville(ville, http) -> tuple[float, float] | None` ; `upsert_offres(rows, url, service_key, http) -> int` ; `run.py` exécutable via `python -m scraper.run`.

- [ ] **Step 1: Test de l'upsert (échoue d'abord)**

Créer `scraper/tests/test_supabase_rest.py` :

```python
from scraper.supabase_rest import upsert_offres


class FakeResp:
    status_code = 201
    def raise_for_status(self): pass


class FakeHttp:
    def __init__(self): self.calls = []
    def post(self, url, headers=None, json=None):
        self.calls.append({"url": url, "headers": headers, "json": json})
        return FakeResp()


def test_upsert_offres_construit_la_requete():
    http = FakeHttp()
    rows = [{"source": "afdn", "source_id": "x", "titre": "T"}]
    n = upsert_offres(rows, "https://proj.supabase.co", "SERVICE_KEY", http)
    assert n == 1
    call = http.calls[0]
    assert call["url"] == "https://proj.supabase.co/rest/v1/offres?on_conflict=source,source_id"
    assert call["headers"]["Authorization"] == "Bearer SERVICE_KEY"
    assert call["headers"]["apikey"] == "SERVICE_KEY"
    assert call["headers"]["Prefer"] == "resolution=merge-duplicates"
    assert call["json"] == rows
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `python3 -m pytest scraper/tests/test_supabase_rest.py -q`
Expected: FAIL (module absent).

- [ ] **Step 3: Écrire `supabase_rest.py`**

```python
def upsert_offres(rows: list[dict], url: str, service_key: str, http) -> int:
    if not rows:
        return 0
    endpoint = f"{url}/rest/v1/offres?on_conflict=source,source_id"
    entetes = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    resp = http.post(endpoint, headers=entetes, json=rows)
    resp.raise_for_status()
    return len(rows)
```

- [ ] **Step 4: Écrire `geocode.py`**

```python
BASE = "https://api-adresse.data.gouv.fr/search/"


def geocode_ville(ville: str, http) -> tuple[float, float] | None:
    if not ville:
        return None
    resp = http.get(BASE, params={"q": ville, "type": "municipality", "limit": 1})
    if resp.status_code != 200:
        return None
    feats = resp.json().get("features") or []
    if not feats:
        return None
    lng, lat = feats[0]["geometry"]["coordinates"]
    return (lat, lng)
```

- [ ] **Step 5: Écrire `run.py`**

```python
import os
import sys
import httpx
from scrapling.fetchers import Fetcher
from scraper.sources.afdn import scrape_afdn, ENTETES
from scraper.geocode import geocode_ville
from scraper.supabase_rest import upsert_offres


def _fetch(url: str, headers: dict) -> str:
    # Scrapling Fetcher : empreinte navigateur, contourne le filtre d'en-têtes AFDN.
    page = Fetcher.get(url, headers=headers)
    return page.html_content


def principal() -> int:
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    offres = scrape_afdn(_fetch)
    print(f"[scraper] AFDN : {len(offres)} offres extraites")

    with httpx.Client(timeout=20) as http:
        cache: dict[str, tuple[float, float] | None] = {}
        for o in offres:
            ville = o.get("ville")
            if ville:
                if ville not in cache:
                    cache[ville] = geocode_ville(ville, http)
                coords = cache[ville]
                if coords:
                    o["latitude"], o["longitude"] = coords
        n = upsert_offres(offres, url, service_key, http)
    print(f"[scraper] {n} offres AFDN upsertées")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
```

Note : confirmer au lancement que `Fetcher.get(...).html_content` renvoie bien le HTML (sinon utiliser l'attribut équivalent, ex. `.body` / `str(page)`), et que `Fetcher.get` accepte `headers`.

- [ ] **Step 6: Lancer les tests Python**

Run: `python3 -m pytest scraper/tests -q`
Expected: PASS (parseur + upsert).

- [ ] **Step 7: Essai réel local (optionnel mais recommandé)**

Charger les variables depuis `.env.local` et lancer le scraper pour vérifier l'upsert de bout en bout :

```bash
set -a; source .env.local; set +a
python3 -m pip install -r scraper/requirements.txt
python3 -m scraper.run
```

Expected : `N offres AFDN upsertées` sans erreur.

- [ ] **Step 8: Commit**

```bash
git add scraper/
git commit -m "feat(scraper): géocodage, upsert Supabase et orchestrateur AFDN

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Workflow GitHub Actions (cron)

**Files:**
- Create: `.github/workflows/scrape.yml`

- [ ] **Step 1: Écrire le workflow**

```yaml
name: Scraping des offres

on:
  schedule:
    - cron: "0 6 * * *"   # tous les jours à 06:00 UTC
  workflow_dispatch: {}

jobs:
  scraper:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Installer les dépendances
        run: python -m pip install -r scraper/requirements.txt
      - name: Lancer le scraper
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: python -m scraper.run
```

- [ ] **Step 2: Vérifier la syntaxe et l'ensemble**

Run: `npx vitest run src/lib/collector/ && python3 -m pytest scraper/tests -q`
Expected: tous verts.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/scrape.yml
git commit -m "ci(scraper): workflow GitHub Actions cron quotidien pour le scraping AFDN

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes hors code

- Secrets GitHub Actions à créer (Settings → Secrets and variables → Actions) : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Le workflow ne tourne qu'après push sur GitHub.
- Ajouter un site plus tard = un nouveau `scraper/sources/<site>.py` + son ajout dans `run.py` et dans `SOURCES_SCRAPEES` côté Node. Le reste ne bouge pas.
