# JobCompass MVP · Plan 2 · Le Collecteur

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire entrer de vraies offres de diététique en base : interroger France Travail et Adzuna par mots-clés multiples + code métier, normaliser vers le schéma `offres`, dédoublonner de façon idempotente, relier chaque offre à la recherche via `resultats`, exposer un déclencheur, et scorer la pertinence des nouvelles offres par IA (Claude Haiku).

**Architecture:** Le collecteur vit côté serveur et utilise le client Supabase **rôle service** (bypass RLS) déjà créé au Plan 1 (`src/lib/supabase/service.ts`). Chaque source est un **adaptateur** isolé qui transforme ses résultats bruts vers un type commun `NormalizedOffer`. Un orchestrateur enchaîne : adaptateurs → fusion/dédoublonnage → écriture en base → scoring IA des seules nouvelles offres. Un endpoint `POST /api/collect` (protégé par un secret) déclenche une collecte pour une recherche donnée.

**Tech Stack:** Next.js 16 (route handlers), TypeScript, `@supabase/supabase-js` (client service, déjà installé), `@anthropic-ai/sdk` (nouveau), Vitest.

## Global Constraints

- **Métier (MVP)** : diététique. Code ROME **J1402** injecté automatiquement. Mots-clés par défaut : **`diététicien`, `diététique`, `nutrition`** (déclinés, dédoublonnés).
- **Plafond** : au plus **300 offres par source et par recherche** (respect des limites de débit).
- **Idempotence** : dédoublonnage sur le couple (`source`, `source_id`). Relancer la collecte ne crée jamais de doublon.
- **Scoring économe** : seules les **nouvelles** offres (sans `score_pertinence`) sont notées. Jamais de re-scoring.
- **Rôle service uniquement** : le collecteur écrit via `getServiceClient()` (bypass RLS). Ce code ne s'exécute que côté serveur, jamais dans le navigateur.
- **Modèle IA** : `claude-haiku-4-5` (exact, sans suffixe de date). Pas de `thinking`, pas d'`effort` (rejetés/inutiles sur Haiku 4.5). `max_tokens` petit.
- **Secrets** : `FT_ID`, `FT_SECRET` (déjà présents), `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ANTHROPIC_API_KEY`, `COLLECT_SECRET` — tous en variables d'environnement, jamais committés.
- **Colonnes source de vérité** (table `offres`, créée au Plan 1) : `source, source_id, titre, entreprise, description, contrat, salaire, latitude, longitude, ville, url_postuler, email_contact, date_publication, date_collecte`. Table `resultats` : `recherche_id, offre_id, score_pertinence`.
- **Langue** : messages et logs en français.

---

## Prérequis externes (à faire une fois avant la Task 5 / Task 8)

Ces étapes ne sont pas des tâches de code. Le contrôleur guidera l'utilisateur au moment voulu.

1. **Adzuna** (Task 3 en vrai, Task 6 orchestration) — créer un compte développeur gratuit sur https://developer.adzuna.com/, obtenir `app_id` + `app_key`. Ajouter à `.env.local` :
   ```
   ADZUNA_APP_ID=xxxx
   ADZUNA_APP_KEY=xxxx
   ```
2. **Anthropic** (Task 8) — obtenir une clé API sur https://console.anthropic.com/ (Settings → API Keys). Ajouter à `.env.local` :
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. **Secret du déclencheur** (Task 7) — inventer une chaîne aléatoire et l'ajouter :
   ```
   COLLECT_SECRET=<chaîne aléatoire longue>
   ```

Les Tasks 1, 2, 4, 5, 6, 7 sont entièrement testables avec des mocks/fixtures sans ces clés. La Task 3 (normalisation Adzuna) est testable sur fixtures ; son test live et la Task 8 nécessitent les clés.

---

## File Structure

- `src/lib/collector/types.ts` — `NormalizedOffer`, `SearchParams`.
- `src/lib/collector/keywords.ts` — code ROME diététique + mots-clés par défaut.
- `src/lib/collector/france-travail.ts` — adaptateur France Travail (token, requêtes, normalisation).
- `src/lib/collector/adzuna.ts` — adaptateur Adzuna (requêtes, normalisation).
- `src/lib/collector/dedupe.ts` — fusion multi-sources + dédoublonnage par clé.
- `src/lib/collector/store.ts` — upsert `offres` + liaison `resultats` via client service.
- `src/lib/collector/collect.ts` — orchestrateur d'une collecte pour une recherche.
- `src/lib/collector/score.ts` — scoring IA (Claude Haiku) des nouvelles offres.
- `src/app/api/collect/route.ts` — déclencheur `POST /api/collect`.
- Tests colocalisés `*.test.ts`.

---

## Task 1: Types communs + configuration diététique

**Files:**
- Create: `src/lib/collector/types.ts`, `src/lib/collector/keywords.ts`
- Test: `src/lib/collector/keywords.test.ts`

**Interfaces:**
- Produces :
  - `type NormalizedOffer = { source: string; source_id: string; titre: string; entreprise: string | null; description: string | null; contrat: string | null; salaire: string | null; latitude: number | null; longitude: number | null; ville: string | null; url_postuler: string | null; email_contact: string | null; date_publication: string | null }`
  - `type SearchParams = { motsCles: string[]; codeRome: string; commune?: string; distance?: number; typeContrat?: string }`
  - `CODE_ROME_DIETETIQUE = 'J1402'`
  - `MOTS_CLES_DIETETIQUE = ['diététicien', 'diététique', 'nutrition']`
  - `buildSearchParams(recherche): SearchParams` — construit les paramètres à partir d'une ligne `recherches`, en injectant le code ROME et en fusionnant les mots-clés de la recherche avec les mots-clés par défaut (sans doublon).

- [ ] **Step 1: Écrire le test de `buildSearchParams` (échoue)**

Create `src/lib/collector/keywords.test.ts` :
```ts
import { expect, test } from 'vitest'
import { buildSearchParams, CODE_ROME_DIETETIQUE, MOTS_CLES_DIETETIQUE } from './keywords'

test('injecte le code ROME diététique', () => {
  const p = buildSearchParams({ mots_cles: [], localisation: '44109', rayon_km: 30, type_contrat: 'CDI' })
  expect(p.codeRome).toBe('J1402')
  expect(p.codeRome).toBe(CODE_ROME_DIETETIQUE)
})

test('fusionne les mots-clés de la recherche avec ceux par défaut, sans doublon', () => {
  const p = buildSearchParams({ mots_cles: ['nutrition', 'libéral'], localisation: '44109', rayon_km: 30, type_contrat: null })
  // nutrition est déjà par défaut : pas de doublon
  expect(p.motsCles.filter((m) => m === 'nutrition')).toHaveLength(1)
  expect(p.motsCles).toContain('libéral')
  for (const m of MOTS_CLES_DIETETIQUE) expect(p.motsCles).toContain(m)
})

test('mappe localisation/rayon/contrat', () => {
  const p = buildSearchParams({ mots_cles: [], localisation: '44109', rayon_km: 30, type_contrat: 'CDI' })
  expect(p.commune).toBe('44109')
  expect(p.distance).toBe(30)
  expect(p.typeContrat).toBe('CDI')
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- keywords`
Expected : FAIL (modules introuvables).

- [ ] **Step 3: Implémenter les types**

Create `src/lib/collector/types.ts` :
```ts
export type NormalizedOffer = {
  source: string
  source_id: string
  titre: string
  entreprise: string | null
  description: string | null
  contrat: string | null
  salaire: string | null
  latitude: number | null
  longitude: number | null
  ville: string | null
  url_postuler: string | null
  email_contact: string | null
  date_publication: string | null
}

export type SearchParams = {
  motsCles: string[]
  codeRome: string
  commune?: string
  distance?: number
  typeContrat?: string
}

// Sous-ensemble des colonnes de `recherches` utilisées par le collecteur
export type RechercheRow = {
  mots_cles: string[]
  localisation: string | null
  rayon_km: number | null
  type_contrat: string | null
}
```

- [ ] **Step 4: Implémenter la config diététique**

Create `src/lib/collector/keywords.ts` :
```ts
import type { RechercheRow, SearchParams } from './types'

export const CODE_ROME_DIETETIQUE = 'J1402'
export const MOTS_CLES_DIETETIQUE = ['diététicien', 'diététique', 'nutrition']

export function buildSearchParams(recherche: RechercheRow): SearchParams {
  const motsCles = Array.from(new Set([...MOTS_CLES_DIETETIQUE, ...(recherche.mots_cles ?? [])]))
  return {
    motsCles,
    codeRome: CODE_ROME_DIETETIQUE,
    commune: recherche.localisation ?? undefined,
    distance: recherche.rayon_km ?? undefined,
    typeContrat: recherche.type_contrat ?? undefined,
  }
}
```

- [ ] **Step 5: Vérifier que les tests passent**

Run : `npm test -- keywords`
Expected : PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/collector/types.ts src/lib/collector/keywords.ts src/lib/collector/keywords.test.ts
git commit -m "feat(collector): types communs + config diététique (ROME J1402 + mots-clés)"
```

---

## Task 2: Adaptateur France Travail

**Files:**
- Create: `src/lib/collector/france-travail.ts`
- Test: `src/lib/collector/france-travail.test.ts`

**Interfaces:**
- Consumes : `SearchParams`, `NormalizedOffer` (Task 1), `requireEnv` (Plan 1, `src/lib/env.ts`).
- Produces :
  - `buildFtQuery(params, mot: string): string` — construit la query string d'un appel de recherche pour UN mot-clé (le collecteur boucle sur les mots-clés).
  - `normalizeFtOffre(raw): NormalizedOffer` — transforme une offre brute France Travail vers le schéma commun (`source: 'france_travail'`).
  - `fetchFtToken(fetchImpl?): Promise<string>` — obtient un jeton OAuth (client credentials). `fetchImpl` injectable pour test.
  - `searchFranceTravail(params, deps?): Promise<NormalizedOffer[]>` — pagine jusqu'au plafond (300), dédoublonne par `source_id` interne, renvoie des offres normalisées. `deps` (token + fetch) injectables.

- [ ] **Step 1: Écrire les tests des transformations pures (échoue)**

Create `src/lib/collector/france-travail.test.ts` :
```ts
import { expect, test } from 'vitest'
import { buildFtQuery, normalizeFtOffre } from './france-travail'

test('buildFtQuery inclut mot-clé, code ROME, commune, distance, contrat', () => {
  const q = buildFtQuery(
    { motsCles: [], codeRome: 'J1402', commune: '44109', distance: 30, typeContrat: 'CDI' },
    'diététicien',
  )
  expect(q).toContain('motsCles=di%C3%A9t%C3%A9ticien')
  expect(q).toContain('codeROME=J1402')
  expect(q).toContain('commune=44109')
  expect(q).toContain('distance=30')
  expect(q).toContain('typeContrat=CDI')
})

test('normalizeFtOffre mappe les champs et pose source france_travail', () => {
  const raw = {
    id: 'FT123',
    intitule: 'Diététicien(ne) en EHPAD',
    entreprise: { nom: 'Les Tilleuls' },
    description: 'Poste...',
    typeContratLibelle: 'CDI',
    salaire: { libelle: '2100 EUR' },
    lieuTravail: { latitude: 47.2, longitude: -1.5, libelle: 'Nantes' },
    origineOffre: { urlOrigine: 'https://candidat.francetravail.fr/offres/FT123' },
    dateCreation: '2026-07-20T10:00:00.000Z',
    contact: { courriel: 'rh@tilleuls.fr' },
  }
  const o = normalizeFtOffre(raw)
  expect(o.source).toBe('france_travail')
  expect(o.source_id).toBe('FT123')
  expect(o.titre).toBe('Diététicien(ne) en EHPAD')
  expect(o.entreprise).toBe('Les Tilleuls')
  expect(o.contrat).toBe('CDI')
  expect(o.salaire).toBe('2100 EUR')
  expect(o.latitude).toBe(47.2)
  expect(o.longitude).toBe(-1.5)
  expect(o.ville).toBe('Nantes')
  expect(o.url_postuler).toContain('FT123')
  expect(o.email_contact).toBe('rh@tilleuls.fr')
  expect(o.date_publication).toBe('2026-07-20T10:00:00.000Z')
})

test('normalizeFtOffre tolère les champs manquants', () => {
  const o = normalizeFtOffre({ id: 'X', intitule: 'T' })
  expect(o.entreprise).toBeNull()
  expect(o.latitude).toBeNull()
  expect(o.email_contact).toBeNull()
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- france-travail`
Expected : FAIL (module introuvable).

- [ ] **Step 3: Implémenter l'adaptateur**

Create `src/lib/collector/france-travail.ts` :
```ts
import { requireEnv } from '@/lib/env'
import type { NormalizedOffer, SearchParams } from './types'

const TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire'
const SEARCH_URL = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search'
const PAGE_SIZE = 150
const MAX_OFFRES = 300

export function buildFtQuery(params: SearchParams, mot: string): string {
  const qs = new URLSearchParams()
  qs.set('motsCles', mot)
  qs.set('codeROME', params.codeRome)
  if (params.commune) qs.set('commune', params.commune)
  if (params.distance != null) qs.set('distance', String(params.distance))
  if (params.typeContrat) qs.set('typeContrat', params.typeContrat)
  return qs.toString()
}

export function normalizeFtOffre(raw: any): NormalizedOffer {
  return {
    source: 'france_travail',
    source_id: String(raw.id),
    titre: raw.intitule ?? '',
    entreprise: raw.entreprise?.nom ?? null,
    description: raw.description ?? null,
    contrat: raw.typeContratLibelle ?? raw.typeContrat ?? null,
    salaire: raw.salaire?.libelle ?? null,
    latitude: raw.lieuTravail?.latitude ?? null,
    longitude: raw.lieuTravail?.longitude ?? null,
    ville: raw.lieuTravail?.libelle ?? null,
    url_postuler: raw.origineOffre?.urlOrigine ?? null,
    email_contact: raw.contact?.courriel ?? null,
    date_publication: raw.dateCreation ?? null,
  }
}

export async function fetchFtToken(fetchImpl: typeof fetch = fetch): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: requireEnv('FT_ID'),
    client_secret: requireEnv('FT_SECRET'),
    scope: 'api_offresdemploiv2 o2dsoffre',
  })
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`France Travail token: HTTP ${res.status}`)
  const json = await res.json()
  return json.access_token as string
}

type Deps = { token?: string; fetchImpl?: typeof fetch }

export async function searchFranceTravail(params: SearchParams, deps: Deps = {}): Promise<NormalizedOffer[]> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const token = deps.token ?? (await fetchFtToken(fetchImpl))
  const bySourceId = new Map<string, NormalizedOffer>()

  for (const mot of params.motsCles) {
    const base = buildFtQuery(params, mot)
    let start = 0
    while (start < MAX_OFFRES) {
      const end = Math.min(start + PAGE_SIZE, MAX_OFFRES) - 1
      const res = await fetchImpl(`${SEARCH_URL}?${base}&range=${start}-${end}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 204) break // aucune offre
      if (!res.ok) break // erreur : on arrête ce mot-clé sans planter
      const json = await res.json()
      const offres = (json.resultats ?? []) as any[]
      for (const raw of offres) {
        const o = normalizeFtOffre(raw)
        bySourceId.set(o.source_id, o) // dédoublonnage intra-source
      }
      if (offres.length < PAGE_SIZE) break // dernière page
      start += PAGE_SIZE
    }
  }
  return [...bySourceId.values()]
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run : `npm test -- france-travail`
Expected : PASS (les 3 tests des transformations pures).

- [ ] **Step 5: Commit**

```bash
git add src/lib/collector/france-travail.ts src/lib/collector/france-travail.test.ts
git commit -m "feat(collector): adaptateur France Travail (token, requêtes, normalisation)"
```

---

## Task 3: Adaptateur Adzuna

**Files:**
- Create: `src/lib/collector/adzuna.ts`
- Test: `src/lib/collector/adzuna.test.ts`

**Interfaces:**
- Consumes : `SearchParams`, `NormalizedOffer` (Task 1), `requireEnv`.
- Produces :
  - `buildAdzunaUrl(params, mot, page): string` — URL d'un appel Adzuna (France) pour un mot-clé et une page.
  - `normalizeAdzunaOffre(raw): NormalizedOffer` — transforme une offre Adzuna vers le schéma commun (`source: 'adzuna'`).
  - `searchAdzuna(params, deps?): Promise<NormalizedOffer[]>` — pagine jusqu'au plafond (300), dédoublonne par `source_id`.

- [ ] **Step 1: Écrire les tests des transformations (échoue)**

Create `src/lib/collector/adzuna.test.ts` :
```ts
import { expect, test, beforeEach } from 'vitest'
import { buildAdzunaUrl, normalizeAdzunaOffre } from './adzuna'

beforeEach(() => {
  process.env.ADZUNA_APP_ID = 'id123'
  process.env.ADZUNA_APP_KEY = 'key123'
})

test('buildAdzunaUrl vise la France et inclut le mot-clé + identifiants', () => {
  const url = buildAdzunaUrl({ motsCles: [], codeRome: 'J1402' }, 'diététicien', 1)
  expect(url).toContain('/jobs/fr/search/1')
  expect(url).toContain('app_id=id123')
  expect(url).toContain('app_key=key123')
  expect(url).toContain('what=di%C3%A9t%C3%A9ticien')
})

test('normalizeAdzunaOffre mappe les champs et pose source adzuna', () => {
  const raw = {
    id: 'AZ789',
    title: 'Diététicien libéral',
    company: { display_name: 'Clinique du Parc' },
    description: 'Vacations...',
    contract_time: 'part_time',
    salary_min: 24000,
    salary_max: 28000,
    latitude: 47.2,
    longitude: -1.6,
    location: { display_name: 'Saint-Herblain' },
    redirect_url: 'https://www.adzuna.fr/jobs/land/ad/AZ789',
    created: '2026-07-21T09:00:00Z',
  }
  const o = normalizeAdzunaOffre(raw)
  expect(o.source).toBe('adzuna')
  expect(o.source_id).toBe('AZ789')
  expect(o.titre).toBe('Diététicien libéral')
  expect(o.entreprise).toBe('Clinique du Parc')
  expect(o.contrat).toBe('part_time')
  expect(o.salaire).toBe('24000 - 28000')
  expect(o.ville).toBe('Saint-Herblain')
  expect(o.url_postuler).toContain('AZ789')
  expect(o.email_contact).toBeNull() // Adzuna n'expose pas d'email
  expect(o.date_publication).toBe('2026-07-21T09:00:00Z')
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- adzuna`
Expected : FAIL (module introuvable).

- [ ] **Step 3: Implémenter l'adaptateur**

Create `src/lib/collector/adzuna.ts` :
```ts
import { requireEnv } from '@/lib/env'
import type { NormalizedOffer, SearchParams } from './types'

const RESULTS_PER_PAGE = 50
const MAX_OFFRES = 300

export function buildAdzunaUrl(params: SearchParams, mot: string, page: number): string {
  const qs = new URLSearchParams()
  qs.set('app_id', requireEnv('ADZUNA_APP_ID'))
  qs.set('app_key', requireEnv('ADZUNA_APP_KEY'))
  qs.set('what', mot)
  qs.set('results_per_page', String(RESULTS_PER_PAGE))
  if (params.commune) qs.set('where', params.commune)
  if (params.distance != null) qs.set('distance', String(params.distance))
  return `https://api.adzuna.com/v1/api/jobs/fr/search/${page}?${qs.toString()}`
}

export function normalizeAdzunaOffre(raw: any): NormalizedOffer {
  const min = raw.salary_min, max = raw.salary_max
  const salaire = min && max ? `${min} - ${max}` : min ? String(min) : null
  return {
    source: 'adzuna',
    source_id: String(raw.id),
    titre: raw.title ?? '',
    entreprise: raw.company?.display_name ?? null,
    description: raw.description ?? null,
    contrat: raw.contract_time ?? raw.contract_type ?? null,
    salaire,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    ville: raw.location?.display_name ?? null,
    url_postuler: raw.redirect_url ?? null,
    email_contact: null,
    date_publication: raw.created ?? null,
  }
}

type Deps = { fetchImpl?: typeof fetch }

export async function searchAdzuna(params: SearchParams, deps: Deps = {}): Promise<NormalizedOffer[]> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const bySourceId = new Map<string, NormalizedOffer>()

  for (const mot of params.motsCles) {
    let page = 1
    while (bySourceId.size < MAX_OFFRES) {
      const res = await fetchImpl(buildAdzunaUrl(params, mot, page))
      if (!res.ok) break // erreur : on arrête ce mot-clé sans planter
      const json = await res.json()
      const offres = (json.results ?? []) as any[]
      for (const raw of offres) {
        const o = normalizeAdzunaOffre(raw)
        bySourceId.set(o.source_id, o)
      }
      if (offres.length < RESULTS_PER_PAGE) break // dernière page
      page += 1
    }
  }
  return [...bySourceId.values()]
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run : `npm test -- adzuna`
Expected : PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/collector/adzuna.ts src/lib/collector/adzuna.test.ts
git commit -m "feat(collector): adaptateur Adzuna (requêtes France, normalisation)"
```

---

## Task 4: Fusion multi-sources et dédoublonnage

**Files:**
- Create: `src/lib/collector/dedupe.ts`
- Test: `src/lib/collector/dedupe.test.ts`

**Interfaces:**
- Consumes : `NormalizedOffer` (Task 1).
- Produces : `dedupeOffres(...lists: NormalizedOffer[][]): NormalizedOffer[]` — fusionne plusieurs listes et retire les doublons sur la clé (`source`, `source_id`). En cas de doublon exact, garde la première occurrence.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/collector/dedupe.test.ts` :
```ts
import { expect, test } from 'vitest'
import { dedupeOffres } from './dedupe'
import type { NormalizedOffer } from './types'

function o(source: string, id: string): NormalizedOffer {
  return {
    source, source_id: id, titre: `${source}-${id}`, entreprise: null, description: null,
    contrat: null, salaire: null, latitude: null, longitude: null, ville: null,
    url_postuler: null, email_contact: null, date_publication: null,
  }
}

test('dédoublonne sur (source, source_id) et fusionne les listes', () => {
  const ft = [o('france_travail', '1'), o('france_travail', '1'), o('france_travail', '2')]
  const az = [o('adzuna', '1')] // même id mais source différente = offre distincte
  const merged = dedupeOffres(ft, az)
  expect(merged).toHaveLength(3)
  const keys = merged.map((x) => `${x.source}:${x.source_id}`)
  expect(keys).toContain('france_travail:1')
  expect(keys).toContain('france_travail:2')
  expect(keys).toContain('adzuna:1')
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- dedupe`
Expected : FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

Create `src/lib/collector/dedupe.ts` :
```ts
import type { NormalizedOffer } from './types'

export function dedupeOffres(...lists: NormalizedOffer[][]): NormalizedOffer[] {
  const byKey = new Map<string, NormalizedOffer>()
  for (const list of lists) {
    for (const o of list) {
      const key = `${o.source}:${o.source_id}`
      if (!byKey.has(key)) byKey.set(key, o) // garde la première occurrence
    }
  }
  return [...byKey.values()]
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run : `npm test -- dedupe`
Expected : PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/collector/dedupe.ts src/lib/collector/dedupe.test.ts
git commit -m "feat(collector): fusion multi-sources + dédoublonnage par (source, source_id)"
```

---

## Task 5: Écriture en base (upsert offres + liaison resultats)

**Files:**
- Create: `src/lib/collector/store.ts`
- Test: `src/lib/collector/store.test.ts`

**Interfaces:**
- Consumes : `NormalizedOffer` (Task 1), un `SupabaseClient` (rôle service) injecté.
- Produces :
  - `type StoredOffre = { id: string; source: string; source_id: string; was_new: boolean }`
  - `storeOffres(client, offres: NormalizedOffer[]): Promise<StoredOffre[]>` — upsert les offres dans `offres` (conflit sur `(source, source_id)` → met à jour `date_collecte`), renvoie leurs `id` en base et un drapeau `was_new` (offre inédite ou déjà connue).
  - `linkResultats(client, rechercheId, stored: StoredOffre[]): Promise<void>` — upsert une ligne `resultats` par offre (clé primaire (`recherche_id`, `offre_id`)), sans écraser un `score_pertinence` existant.

- [ ] **Step 1: Écrire les tests avec un client mocké (échoue)**

Create `src/lib/collector/store.test.ts` :
```ts
import { expect, test, vi } from 'vitest'
import { storeOffres, linkResultats } from './store'
import type { NormalizedOffer } from './types'

function offer(id: string): NormalizedOffer {
  return {
    source: 'france_travail', source_id: id, titre: 'T', entreprise: null, description: null,
    contrat: null, salaire: null, latitude: null, longitude: null, ville: null,
    url_postuler: null, email_contact: null, date_publication: null,
  }
}

test('storeOffres upsert sur (source, source_id) et renvoie les ids', async () => {
  const rows = [{ id: 'uuid-1', source: 'france_travail', source_id: 'A' }]
  const select = vi.fn().mockResolvedValue({ data: rows, error: null })
  const upsert = vi.fn(() => ({ select }))
  const client = { from: vi.fn(() => ({ upsert })) } as any

  const stored = await storeOffres(client, [offer('A')])
  expect(client.from).toHaveBeenCalledWith('offres')
  expect(upsert).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ source: 'france_travail', source_id: 'A' })]),
    expect.objectContaining({ onConflict: 'source,source_id' }),
  )
  expect(stored[0]).toMatchObject({ id: 'uuid-1', source_id: 'A' })
})

test('linkResultats upsert une ligne resultats par offre sans écraser le score', async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const client = { from: vi.fn(() => ({ upsert })) } as any
  await linkResultats(client, 'rech-1', [{ id: 'uuid-1', source: 'x', source_id: 'A', was_new: true }])
  expect(client.from).toHaveBeenCalledWith('resultats')
  const [payload, opts] = upsert.mock.calls[0]
  expect(payload).toEqual([expect.objectContaining({ recherche_id: 'rech-1', offre_id: 'uuid-1' })])
  // pas de score_pertinence dans le payload → un score existant n'est pas écrasé
  expect(payload[0]).not.toHaveProperty('score_pertinence')
  expect(opts).toMatchObject({ onConflict: 'recherche_id,offre_id', ignoreDuplicates: true })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- store`
Expected : FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

Create `src/lib/collector/store.ts` :
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NormalizedOffer } from './types'

export type StoredOffre = { id: string; source: string; source_id: string; was_new: boolean }

export async function storeOffres(
  client: SupabaseClient,
  offres: NormalizedOffer[],
): Promise<StoredOffre[]> {
  if (offres.length === 0) return []
  const now = new Date().toISOString()
  const rows = offres.map((o) => ({ ...o, date_collecte: now }))
  const { data, error } = await client
    .from('offres')
    .upsert(rows, { onConflict: 'source,source_id' })
    .select('id, source, source_id')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    source: r.source as string,
    source_id: r.source_id as string,
    was_new: true, // affiné à la Task 8 via le scoring (offre sans score = à traiter)
  }))
}

export async function linkResultats(
  client: SupabaseClient,
  rechercheId: string,
  stored: StoredOffre[],
): Promise<void> {
  if (stored.length === 0) return
  const rows = stored.map((s) => ({ recherche_id: rechercheId, offre_id: s.id }))
  // ignoreDuplicates : ne touche pas une ligne existante (donc ne remet pas score_pertinence à null)
  const { error } = await client
    .from('resultats')
    .upsert(rows, { onConflict: 'recherche_id,offre_id', ignoreDuplicates: true })
  if (error) throw error
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run : `npm test -- store`
Expected : PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/collector/store.ts src/lib/collector/store.test.ts
git commit -m "feat(collector): écriture idempotente offres + liaison resultats"
```

---

## Task 6: Orchestrateur de collecte

**Files:**
- Create: `src/lib/collector/collect.ts`
- Test: `src/lib/collector/collect.test.ts`

**Interfaces:**
- Consumes : `buildSearchParams` (Task 1), `searchFranceTravail` (Task 2), `searchAdzuna` (Task 3), `dedupeOffres` (Task 4), `storeOffres` / `linkResultats` (Task 5), un `SupabaseClient` service.
- Produces : `collectForRecherche(client, recherche, deps?): Promise<{ collected: number; linked: number }>` — pour une ligne `recherches` (avec son `id`), interroge les deux sources, dédoublonne, écrit, relie. `deps` (les fonctions de recherche) injectables ; en défaut elles pointent sur les vrais adaptateurs. Chaque source qui échoue est journalisée et ignorée (l'autre continue).

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/collector/collect.test.ts` :
```ts
import { expect, test, vi } from 'vitest'
import { collectForRecherche } from './collect'
import type { NormalizedOffer } from './types'

function o(source: string, id: string): NormalizedOffer {
  return {
    source, source_id: id, titre: 'T', entreprise: null, description: null, contrat: null,
    salaire: null, latitude: null, longitude: null, ville: null, url_postuler: null,
    email_contact: null, date_publication: null,
  }
}

test('collecte des deux sources, dédoublonne, écrit et relie', async () => {
  const recherche = { id: 'rech-1', mots_cles: [], localisation: '44109', rayon_km: 30, type_contrat: null }
  const storeOffres = vi.fn().mockResolvedValue([
    { id: 'u1', source: 'france_travail', source_id: '1', was_new: true },
    { id: 'u2', source: 'adzuna', source_id: '9', was_new: true },
  ])
  const linkResultats = vi.fn().mockResolvedValue(undefined)
  const res = await collectForRecherche({} as any, recherche, {
    searchFranceTravail: vi.fn().mockResolvedValue([o('france_travail', '1')]),
    searchAdzuna: vi.fn().mockResolvedValue([o('adzuna', '9')]),
    storeOffres,
    linkResultats,
  })
  expect(storeOffres).toHaveBeenCalledOnce()
  expect(storeOffres.mock.calls[0][1]).toHaveLength(2) // 2 offres dédoublonnées
  expect(linkResultats).toHaveBeenCalledWith(expect.anything(), 'rech-1', expect.any(Array))
  expect(res).toEqual({ collected: 2, linked: 2 })
})

test('une source qui échoue n’empêche pas l’autre', async () => {
  const recherche = { id: 'rech-1', mots_cles: [], localisation: null, rayon_km: null, type_contrat: null }
  const res = await collectForRecherche({} as any, recherche, {
    searchFranceTravail: vi.fn().mockRejectedValue(new Error('FT down')),
    searchAdzuna: vi.fn().mockResolvedValue([o('adzuna', '9')]),
    storeOffres: vi.fn().mockResolvedValue([{ id: 'u2', source: 'adzuna', source_id: '9', was_new: true }]),
    linkResultats: vi.fn().mockResolvedValue(undefined),
  })
  expect(res.collected).toBe(1)
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- collect`
Expected : FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

Create `src/lib/collector/collect.ts` :
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSearchParams } from './keywords'
import { searchFranceTravail as ftSearch } from './france-travail'
import { searchAdzuna as azSearch } from './adzuna'
import { dedupeOffres } from './dedupe'
import { storeOffres as store, linkResultats as link } from './store'
import type { NormalizedOffer, RechercheRow } from './types'

type Deps = {
  searchFranceTravail?: (params: any) => Promise<NormalizedOffer[]>
  searchAdzuna?: (params: any) => Promise<NormalizedOffer[]>
  storeOffres?: typeof store
  linkResultats?: typeof link
}

export async function collectForRecherche(
  client: SupabaseClient,
  recherche: RechercheRow & { id: string },
  deps: Deps = {},
): Promise<{ collected: number; linked: number }> {
  const searchFT = deps.searchFranceTravail ?? ftSearch
  const searchAZ = deps.searchAdzuna ?? azSearch
  const storeOffres = deps.storeOffres ?? store
  const linkResultats = deps.linkResultats ?? link

  const params = buildSearchParams(recherche)

  const results = await Promise.allSettled([searchFT(params), searchAZ(params)])
  const lists: NormalizedOffer[][] = []
  for (const r of results) {
    if (r.status === 'fulfilled') lists.push(r.value)
    else console.error('[collect] source en échec :', r.reason)
  }

  const offres = dedupeOffres(...lists)
  const stored = await storeOffres(client, offres)
  await linkResultats(client, recherche.id, stored)
  return { collected: offres.length, linked: stored.length }
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run : `npm test -- collect`
Expected : PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/collector/collect.ts src/lib/collector/collect.test.ts
git commit -m "feat(collector): orchestrateur de collecte (2 sources, dédoublonnage, écriture)"
```

---

## Task 7: Déclencheur HTTP protégé

**Files:**
- Create: `src/app/api/collect/route.ts`
- Test: `src/app/api/collect/route.test.ts`

**Interfaces:**
- Consumes : `getServiceClient` (Plan 1), `collectForRecherche` (Task 6), `requireEnv`.
- Produces : `POST /api/collect` — corps `{ recherche_id }`, en-tête `Authorization: Bearer <COLLECT_SECRET>`. Charge la recherche via le client service, lance `collectForRecherche`, renvoie un récap JSON. Refuse (401) si le secret est absent ou faux.

- [ ] **Step 1: Écrire les tests (échoue)**

Create `src/app/api/collect/route.test.ts` :
```ts
import { expect, test, vi, beforeEach } from 'vitest'

beforeEach(() => { process.env.COLLECT_SECRET = 's3cret' })

vi.mock('@/lib/supabase/service', () => ({
  getServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: () =>
      Promise.resolve({ data: { id: 'rech-1', mots_cles: [], localisation: '44109', rayon_km: 30, type_contrat: null }, error: null }) }) }) }),
  }),
}))
vi.mock('@/lib/collector/collect', () => ({
  collectForRecherche: vi.fn().mockResolvedValue({ collected: 5, linked: 5 }),
}))

import { POST } from './route'

function req(body: unknown, auth?: string) {
  return new Request('http://localhost/api/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  })
}

test('401 sans secret valide', async () => {
  const res = await POST(req({ recherche_id: 'rech-1' }))
  expect(res.status).toBe(401)
})

test('200 et récap avec le bon secret', async () => {
  const res = await POST(req({ recherche_id: 'rech-1' }, 'Bearer s3cret'))
  expect(res.status).toBe(200)
  const json = await res.json()
  expect(json).toMatchObject({ collected: 5, linked: 5 })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- api/collect`
Expected : FAIL (module introuvable).

- [ ] **Step 3: Implémenter la route**

Create `src/app/api/collect/route.ts` :
```ts
import { NextResponse } from 'next/server'
import { requireEnv } from '@/lib/env'
import { getServiceClient } from '@/lib/supabase/service'
import { collectForRecherche } from '@/lib/collector/collect'

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${requireEnv('COLLECT_SECRET')}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { recherche_id } = await request.json()
  if (!recherche_id) {
    return NextResponse.json({ error: 'recherche_id manquant' }, { status: 400 })
  }
  const client = getServiceClient()
  const { data: recherche, error } = await client
    .from('recherches')
    .select('id, mots_cles, localisation, rayon_km, type_contrat')
    .eq('id', recherche_id)
    .single()
  if (error || !recherche) {
    return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
  }
  const result = await collectForRecherche(client, recherche as any)
  return NextResponse.json(result)
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run : `npm test -- api/collect`
Expected : PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/collect/route.ts src/app/api/collect/route.test.ts
git commit -m "feat(collector): déclencheur POST /api/collect protégé par secret"
```

---

## Task 8: Scoring de pertinence par IA (Claude Haiku)

**Files:**
- Create: `src/lib/collector/score.ts`
- Modify: `src/lib/collector/collect.ts` (appeler le scoring après la liaison)
- Test: `src/lib/collector/score.test.ts`

**Interfaces:**
- Consumes : un `SupabaseClient` service, l'`@anthropic-ai/sdk`.
- Produces :
  - `scoreOffre(anthropic, intitule: string, offre: { titre: string; description: string | null }): Promise<number>` — renvoie un entier 0-100 (borné côté code) via `claude-haiku-4-5` en sortie structurée.
  - `scoreNouvellesOffres(client, rechercheId, intitule, deps?): Promise<number>` — sélectionne dans `resultats` les lignes de cette recherche **sans** `score_pertinence`, score chaque offre associée, écrit le score. Renvoie le nombre d'offres scorées. `deps` (client Anthropic + `scoreOffre`) injectables.

- [ ] **Step 1: Installer le SDK Anthropic**

Run :
```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Écrire les tests (échoue)**

Create `src/lib/collector/score.test.ts` :
```ts
import { expect, test, vi } from 'vitest'
import { scoreOffre, scoreNouvellesOffres } from './score'

test('scoreOffre borne la valeur du modèle à 0-100', async () => {
  const anthropic = {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"score": 150}' }],
      }),
    },
  } as any
  const s = await scoreOffre(anthropic, 'Diététicienne Nantes', { titre: 'Diététicien EHPAD', description: null })
  expect(s).toBe(100) // 150 borné à 100
})

test('scoreNouvellesOffres ne score que les lignes sans score et écrit le résultat', async () => {
  // resultats sans score, joints à leur offre
  const rows = [{ offre_id: 'o1', offres: { titre: 'Diététicien EHPAD', description: 'x' } }]
  const is_ = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eq = vi.fn(() => ({ is: is_ }))
  const select = vi.fn(() => ({ eq }))
  const updEq2 = vi.fn().mockResolvedValue({ error: null })
  const updEq1 = vi.fn(() => ({ eq: updEq2 }))
  const update = vi.fn(() => ({ eq: updEq1 }))
  const client = { from: vi.fn(() => ({ select, update })) } as any

  const n = await scoreNouvellesOffres(client, 'rech-1', 'Diététicienne', {
    anthropic: {} as any,
    scoreOffre: vi.fn().mockResolvedValue(92),
  })
  expect(select).toHaveBeenCalled()
  expect(is_).toHaveBeenCalledWith('score_pertinence', null) // seulement les non scorées
  expect(update).toHaveBeenCalledWith({ score_pertinence: 92 })
  expect(n).toBe(1)
})
```

- [ ] **Step 3: Vérifier l'échec**

Run : `npm test -- score`
Expected : FAIL (module introuvable).

- [ ] **Step 4: Implémenter le scoring**

Create `src/lib/collector/score.ts` :
```ts
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

const SCORE_SCHEMA = {
  type: 'object',
  properties: { score: { type: 'integer' } },
  required: ['score'],
  additionalProperties: false,
} as const

export async function scoreOffre(
  anthropic: Anthropic,
  intitule: string,
  offre: { titre: string; description: string | null },
): Promise<number> {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 64,
    output_config: { format: { type: 'json_schema', schema: SCORE_SCHEMA } },
    messages: [
      {
        role: 'user',
        content:
          `Note de 0 à 100 la pertinence de cette offre pour la recherche "${intitule}".\n` +
          `Offre : ${offre.titre}\n${offre.description ?? ''}\n` +
          `Réponds uniquement avec un entier score entre 0 et 100.`,
      },
    ],
  })
  const block = res.content.find((b: any) => b.type === 'text') as any
  const raw = Number(JSON.parse(block?.text ?? '{}').score ?? 0)
  // Le schéma JSON ne peut pas contraindre min/max : on borne ici.
  return Math.max(0, Math.min(100, Math.round(raw)))
}

type Deps = { anthropic?: Anthropic; scoreOffre?: typeof scoreOffre }

export async function scoreNouvellesOffres(
  client: SupabaseClient,
  rechercheId: string,
  intitule: string,
  deps: Deps = {},
): Promise<number> {
  const anthropic = deps.anthropic ?? new Anthropic()
  const scorer = deps.scoreOffre ?? scoreOffre

  const { data, error } = await client
    .from('resultats')
    .select('offre_id, offres(titre, description)')
    .eq('recherche_id', rechercheId)
    .is('score_pertinence', null)
  if (error) throw error

  let n = 0
  for (const row of (data ?? []) as any[]) {
    const offre = row.offres
    if (!offre) continue
    const score = await scorer(anthropic, intitule, offre)
    const { error: upErr } = await client
      .from('resultats')
      .update({ score_pertinence: score })
      .eq('recherche_id', rechercheId)
      .eq('offre_id', row.offre_id)
    if (upErr) throw upErr
    n += 1
  }
  return n
}
```

- [ ] **Step 5: Vérifier que les tests passent**

Run : `npm test -- score`
Expected : PASS

- [ ] **Step 6: Brancher le scoring dans l'orchestrateur**

Modify `src/lib/collector/collect.ts` — importer et appeler le scoring en fin de collecte. Ajouter en tête :
```ts
import { scoreNouvellesOffres } from './score'
```
Étendre le type `Deps` avec `scoreNouvellesOffres?: typeof scoreNouvellesOffres`, la valeur par défaut `const scoreNew = deps.scoreNouvellesOffres ?? scoreNouvellesOffres`, et étendre la signature de retour à `{ collected: number; linked: number; scored: number }`. Après `linkResultats`, ajouter :
```ts
  // Intitulé de la recherche pour le scoring (fallback : premier mot-clé)
  const intitule = (recherche as any).intitule ?? params.motsCles[0] ?? 'diététique'
  let scored = 0
  try {
    scored = await scoreNew(client, recherche.id, intitule)
  } catch (e) {
    console.error('[collect] scoring IA en échec (offres stockées sans score) :', e)
  }
  return { collected: offres.length, linked: stored.length, scored }
```
Mettre à jour le test `collect.test.ts` : injecter `scoreNouvellesOffres: vi.fn().mockResolvedValue(2)` dans les deux cas et attendre `scored` dans le retour (ex. `expect(res).toMatchObject({ collected: 2, linked: 2, scored: 2 })`). La route Task 7 renvoie déjà l'objet complet, aucun changement requis là-bas.

- [ ] **Step 7: Vérifier toute la suite**

Run : `npm test`
Expected : tous les tests PASS (collector + Plan 1). Le scoring live n'est pas testé automatiquement (mocké) ; il s'exercera en vrai à la Task 9.

- [ ] **Step 8: Commit**

```bash
git add src/lib/collector/score.ts src/lib/collector/collect.ts src/lib/collector/collect.test.ts package.json package-lock.json
git commit -m "feat(collector): scoring de pertinence IA (Claude Haiku) des nouvelles offres"
```

---

## Task 9: Vérification manuelle de bout en bout

**Files:** aucun (validation). Nécessite `.env.local` complété (Adzuna, Anthropic, COLLECT_SECRET) et une recherche en base.

- [ ] **Step 1: Créer une recherche de test en base**

Dans le SQL Editor Supabase, insérer une recherche pour le compte de démo (récupérer d'abord son `user_id` via *Authentication → Users*), puis :
```sql
insert into public.recherches (user_id, intitule, mots_cles, code_metier, localisation, rayon_km, type_contrat)
values ('<user_id_du_compte_demo>', 'Diététicienne Nantes', '{}', 'J1402', '44109', 30, null)
returning id;
```
Noter l'`id` renvoyé.

- [ ] **Step 2: Lancer l'app et déclencher une collecte**

Run (app démarrée avec `npm run dev`) :
```bash
curl -s -X POST http://localhost:3000/api/collect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep '^COLLECT_SECRET=' .env.local | cut -d= -f2-)" \
  -d '{"recherche_id":"<id_de_la_recherche>"}'
```
Expected : un JSON `{"collected":N,"linked":N,"scored":M}` avec N > 0.

- [ ] **Step 3: Vérifier en base**

Dans le Table Editor Supabase : `offres` contient des lignes `france_travail`/`adzuna` ; `resultats` relie la recherche aux offres avec un `score_pertinence` renseigné.

- [ ] **Step 4: Vérifier l'idempotence**

Relancer exactement la même commande qu'au Step 2. Expected : `collected` similaire, mais **aucun doublon** créé dans `offres` (même total de lignes), et `scored` proche de 0 (les offres déjà notées ne sont pas re-scorées).

- [ ] **Step 5: Lancer toute la suite de tests**

Run : `npm test`
Expected : tous les tests unitaires PASS.

---

## Self-Review (rempli à la rédaction)

- **Couverture spec (section 7)** : recherche multi-mots-clés + code ROME J1402 (Tasks 1-3) ; pagination plafonnée à 300/source (Tasks 2-3) ; normalisation multi-sources vers le schéma commun (Tasks 2-3) ; dédoublonnage idempotent sur (source, source_id) (Tasks 4-5) ; liaison recherche↔offre dans `resultats` (Task 5) ; déclencheur (Task 7) ; scoring IA des seules nouvelles offres via Claude Haiku (Task 8) ; robustesse (une source qui tombe n'arrête pas l'autre — Task 6 ; échec de scoring non bloquant — Task 8). Le cron Vercel (planification) est hors de ce plan : le déclencheur `/api/collect` est prêt à être appelé par un cron ultérieurement.
- **Placeholders** : aucun ; chaque étape contient le code réel.
- **Cohérence des types** : `NormalizedOffer` (Task 1) réutilisé tel quel Tasks 2-6 ; `StoredOffre` (Task 5) consommé Task 6 ; colonnes alignées sur le schéma du Plan 1 (`offres`, `resultats`) ; `claude-haiku-4-5` exact ; `output_config.format` avec bornage 0-100 côté code car le schéma JSON ne contraint pas min/max.
- **Dépendances externes** : Adzuna et Anthropic requièrent une inscription (prérequis en tête) ; les Tasks sont testables sans ces clés grâce à l'injection de dépendances et aux fixtures ; la Task 9 est la seule vérification live.
