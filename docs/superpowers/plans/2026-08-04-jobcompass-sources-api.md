# Sources API Adzuna + Jooble · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** ajouter Jooble comme troisième source d'offres et activer Adzuna, pour élargir les résultats de JobCompass au-delà de France Travail.

**Architecture :** le collecteur (`collect.ts`) lance déjà chaque source en parallèle via `Promise.allSettled`, déduplique par `source:source_id`, upsert et lie. On ajoute un module `jooble.ts` calqué sur `adzuna.ts` (fonctions pures, `fetch` injectable) qui géocode les villes via `geocodeCommune`, puis on le branche comme troisième source. Adzuna ne demande aucun code, seulement ses clés en environnement.

**Tech Stack :** TypeScript, Next.js 16, Supabase, `fetch` natif injectable, Vitest.

## Global Constraints

- Jamais de tiret cadratin dans le code, les commentaires ou la doc. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- `JOOBLE_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` restent server-side : lues via `requireEnv`, jamais préfixées `NEXT_PUBLIC_`.
- Chaque fonction réseau prend un `fetch` injectable (`deps.fetchImpl`) pour être testable sans réseau.
- Messages de commit terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Ne rien pousser sur GitHub : commits locaux uniquement.

## File Structure

- `src/lib/collector/jooble.ts` (créé) : `buildJoobleRequest`, `normalizeJoobleOffre`, `searchJooble`. Une source, un fichier, même forme que `adzuna.ts`.
- `src/lib/collector/jooble.test.ts` (créé) : tests unitaires du module.
- `src/lib/collector/collect.ts` (modifié) : branchement de Jooble comme 3ᵉ source.
- `src/lib/collector/collect.test.ts` (modifié) : couverture du branchement Jooble.

Adzuna : aucun fichier, activation par variables d'environnement hors code.

---

### Task 1: Module Jooble

**Files:**
- Create: `src/lib/collector/jooble.ts`
- Test: `src/lib/collector/jooble.test.ts`

**Interfaces:**
- Consumes : `NormalizedOffer`, `SearchParams` depuis `./types` ; `geocodeCommune(query: string, fetchImpl?: typeof fetch) => Promise<{ insee: string; lat: number; lng: number; label: string } | null>` depuis `@/lib/geo/adresse` ; `requireEnv` depuis `@/lib/env`.
- Produces : `buildJoobleRequest(params: SearchParams, mot: string, page: number) => { url: string; body: Record<string, string> }` ; `normalizeJoobleOffre(raw: any) => NormalizedOffer` ; `searchJooble(params: SearchParams, deps?: { fetchImpl?: typeof fetch; geocode?: typeof geocodeCommune }) => Promise<NormalizedOffer[]>`.

- [ ] **Step 1: Écrire les tests du module (échouent d'abord)**

Créer `src/lib/collector/jooble.test.ts` :

```ts
import { expect, test, beforeEach, vi } from 'vitest'
import { buildJoobleRequest, normalizeJoobleOffre, searchJooble } from './jooble'

beforeEach(() => { process.env.JOOBLE_API_KEY = 'jk123' })

test('buildJoobleRequest cible l’API avec la clé et le corps attendu', () => {
  const { url, body } = buildJoobleRequest(
    { motsCles: [], codeRome: 'J1402', commune: 'Nantes', distance: 25 }, 'diététicien', 2)
  expect(url).toBe('https://jooble.org/api/jk123')
  expect(body).toEqual({ keywords: 'diététicien', page: '2', location: 'Nantes', radius: '25' })
})

test('buildJoobleRequest omet location et radius si absents', () => {
  const { body } = buildJoobleRequest({ motsCles: [], codeRome: 'J1402' }, 'nutrition', 1)
  expect(body).toEqual({ keywords: 'nutrition', page: '1' })
})

test('normalizeJoobleOffre mappe les champs, nettoie le HTML et pose source jooble', () => {
  const raw = {
    id: 123456,
    title: 'Diététicien H/F',
    company: 'EHPAD Les Tilleuls',
    snippet: 'Poste en <b>CDI</b> à pourvoir',
    type: 'CDI',
    salary: '2000 - 2300 EUR',
    location: 'Nantes',
    link: 'https://jooble.org/jdp/123456',
    updated: '2026-07-30T08:00:00Z',
  }
  const o = normalizeJoobleOffre(raw)
  expect(o.source).toBe('jooble')
  expect(o.source_id).toBe('123456')
  expect(o.titre).toBe('Diététicien H/F')
  expect(o.entreprise).toBe('EHPAD Les Tilleuls')
  expect(o.description).toBe('Poste en CDI à pourvoir')
  expect(o.contrat).toBe('CDI')
  expect(o.salaire).toBe('2000 - 2300 EUR')
  expect(o.ville).toBe('Nantes')
  expect(o.url_postuler).toBe('https://jooble.org/jdp/123456')
  expect(o.latitude).toBeNull()
  expect(o.email_contact).toBeNull()
  expect(o.date_publication).toBe('2026-07-30T08:00:00Z')
})

test('normalizeJoobleOffre met à null les champs manquants', () => {
  const o = normalizeJoobleOffre({ id: 7, title: 'X' })
  expect(o.entreprise).toBeNull()
  expect(o.salaire).toBeNull()
  expect(o.contrat).toBeNull()
  expect(o.description).toBeNull()
})

test('searchJooble pagine puis s’arrête sur une page vide', async () => {
  let calls = 0
  const mockFetch = vi.fn(async () => {
    calls++
    const jobs = calls <= 2
      ? Array.from({ length: 3 }, (_, i) => ({ id: `p${calls}-${i}`, title: 'T', location: 'Nantes' }))
      : []
    return new Response(JSON.stringify({ jobs }), { status: 200 })
  })
  const geocode = vi.fn(async () => ({ insee: '44109', lat: 47.2, lng: -1.55, label: 'Nantes' }))
  const offres = await searchJooble(
    { motsCles: ['diét'], codeRome: 'J1402' },
    { fetchImpl: mockFetch as any, geocode: geocode as any })
  expect(offres).toHaveLength(6) // 2 pages x 3 offres
  expect(mockFetch).toHaveBeenCalledTimes(3) // la 3e page vide arrête la boucle
  expect(offres.every((o) => o.source === 'jooble')).toBe(true)
})

test('searchJooble s’arrête sans exception si la réponse n’est pas ok', async () => {
  const mockFetch = vi.fn(async () => new Response('nope', { status: 500 }))
  const offres = await searchJooble(
    { motsCles: ['x'], codeRome: 'J1402' },
    { fetchImpl: mockFetch as any, geocode: vi.fn() as any })
  expect(offres).toHaveLength(0)
})

test('searchJooble géocode chaque ville distincte une seule fois', async () => {
  const jobs = [
    { id: '1', title: 'A', location: 'Nantes' },
    { id: '2', title: 'B', location: 'Nantes' },
    { id: '3', title: 'C', location: 'Rennes' },
  ]
  let page = 0
  const mockFetch = vi.fn(async () => {
    page++
    return new Response(JSON.stringify({ jobs: page === 1 ? jobs : [] }), { status: 200 })
  })
  const geocode = vi.fn(async (ville: string) =>
    ville === 'Nantes' ? { insee: '44109', lat: 47.2, lng: -1.55, label: 'Nantes' } : null)
  const offres = await searchJooble(
    { motsCles: ['x'], codeRome: 'J1402' },
    { fetchImpl: mockFetch as any, geocode: geocode as any })
  expect(geocode).toHaveBeenCalledTimes(2) // Nantes + Rennes, pas 3 fois
  expect(offres.filter((o) => o.ville === 'Nantes').every((o) => o.latitude === 47.2 && o.longitude === -1.55)).toBe(true)
  expect(offres.find((o) => o.ville === 'Rennes')!.latitude).toBeNull() // ville non résolue
})
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npx vitest run src/lib/collector/jooble.test.ts`
Expected: FAIL (`jooble.ts` n'existe pas encore).

- [ ] **Step 3: Écrire le module**

Créer `src/lib/collector/jooble.ts` :

```ts
import { requireEnv } from '@/lib/env'
import { geocodeCommune } from '@/lib/geo/adresse'
import type { NormalizedOffer, SearchParams } from './types'

const MAX_OFFRES = 300
const MAX_PAGES = 15

export function buildJoobleRequest(
  params: SearchParams, mot: string, page: number,
): { url: string; body: Record<string, string> } {
  const url = `https://jooble.org/api/${requireEnv('JOOBLE_API_KEY')}`
  const body: Record<string, string> = { keywords: mot, page: String(page) }
  if (params.commune) body.location = params.commune
  if (params.distance != null) body.radius = String(params.distance)
  return { url, body }
}

// Jooble renvoie des extraits avec des balises (<b>...) : on les retire.
function nettoyerHtml(s: string | null | undefined): string | null {
  if (!s) return null
  const clean = s.replace(/<[^>]*>/g, '').trim()
  return clean || null
}

export function normalizeJoobleOffre(raw: any): NormalizedOffer {
  return {
    source: 'jooble',
    source_id: String(raw.id),
    titre: raw.title ?? '',
    entreprise: raw.company || null,
    entreprise_logo: null, // Jooble ne fournit pas de logo
    description: nettoyerHtml(raw.snippet),
    contrat: raw.type || null,
    salaire: raw.salary || null,
    latitude: null, // rempli à l'étape géocodage
    longitude: null,
    ville: raw.location || null,
    url_postuler: raw.link || null,
    email_contact: null,
    date_publication: raw.updated || null,
  }
}

type Deps = { fetchImpl?: typeof fetch; geocode?: typeof geocodeCommune }

export async function searchJooble(params: SearchParams, deps: Deps = {}): Promise<NormalizedOffer[]> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const geocode = deps.geocode ?? geocodeCommune
  const bySourceId = new Map<string, NormalizedOffer>()

  for (const mot of params.motsCles) {
    for (let page = 1; page <= MAX_PAGES && bySourceId.size < MAX_OFFRES; page++) {
      const { url, body } = buildJoobleRequest(params, mot, page)
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) break // erreur : on arrête ce mot-clé sans planter
      const json = await res.json()
      const jobs = (json.jobs ?? []) as any[]
      if (jobs.length === 0) break // plus de résultats
      for (const raw of jobs) {
        const o = normalizeJoobleOffre(raw)
        bySourceId.set(o.source_id, o)
      }
    }
  }

  const offres = [...bySourceId.values()].slice(0, MAX_OFFRES)

  // Jooble ne donne pas de coordonnées : on géocode chaque ville distincte une seule fois.
  const cache = new Map<string, { lat: number; lng: number } | null>()
  for (const o of offres) {
    if (!o.ville) continue
    if (!cache.has(o.ville)) {
      const g = await geocode(o.ville, fetchImpl)
      cache.set(o.ville, g ? { lat: g.lat, lng: g.lng } : null)
    }
    const coords = cache.get(o.ville)
    if (coords) { o.latitude = coords.lat; o.longitude = coords.lng }
  }

  return offres
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `npx vitest run src/lib/collector/jooble.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/collector/jooble.ts src/lib/collector/jooble.test.ts
git commit -m "feat(collecte): source Jooble (recherche paginée + géocodage des villes)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Branchement de Jooble dans le collecteur

**Files:**
- Modify: `src/lib/collector/collect.ts`
- Test: `src/lib/collector/collect.test.ts`

**Interfaces:**
- Consumes : `searchJooble` depuis `./jooble` (signature définie en Task 1).
- Produces : `collectForRecherche` lance désormais trois sources ; le type `Deps` accepte `searchJooble?: (params: any) => Promise<NormalizedOffer[]>`.

- [ ] **Step 1: Mettre à jour les tests du collecteur (échouent d'abord)**

Remplacer les deux tests de `src/lib/collector/collect.test.ts` par ces versions (ajout de la source Jooble) :

```ts
test('collecte des trois sources, dédoublonne, écrit et relie', async () => {
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
    storeOffres,
    linkResultats,
  })
  expect(storeOffres).toHaveBeenCalledOnce()
  expect(storeOffres.mock.calls[0][1]).toHaveLength(3) // 3 offres dédoublonnées
  expect(linkResultats).toHaveBeenCalledWith(expect.anything(), 'rech-1', expect.any(Array))
  expect(res).toMatchObject({ collected: 3, linked: 3 })
})

test('une source qui échoue n’empêche pas les autres', async () => {
  const recherche = {
    id: 'rech-1', mots_cles: [], localisation: null,
    rayon_km: null, type_contrat: null,
  }
  const res = await collectForRecherche({} as any, recherche, {
    searchFranceTravail: vi.fn().mockRejectedValue(new Error('FT down')),
    searchAdzuna: vi.fn().mockResolvedValue([o('adzuna', '9')]),
    searchJooble: vi.fn().mockRejectedValue(new Error('Jooble down')),
    storeOffres: vi.fn().mockResolvedValue([{ id: 'u2', source: 'adzuna', source_id: '9' }]),
    linkResultats: vi.fn().mockResolvedValue(undefined),
  })
  expect(res.collected).toBe(1)
})
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npx vitest run src/lib/collector/collect.test.ts`
Expected: FAIL (Jooble non branché : `collected` vaut 2, la clé `searchJooble` est ignorée).

- [ ] **Step 3: Brancher Jooble dans `collect.ts`**

Dans `src/lib/collector/collect.ts` :

Ajouter l'import après la ligne d'import d'Adzuna :

```ts
import { searchJooble as jbSearch } from './jooble'
```

Ajouter le champ au type `Deps` (après `searchAdzuna?`) :

```ts
  searchJooble?: (params: any) => Promise<NormalizedOffer[]>
```

Résoudre la dépendance (après `const searchAZ = ...`) :

```ts
  const searchJB = deps.searchJooble ?? jbSearch
```

Ajouter la source au `Promise.allSettled` :

```ts
  const results = await Promise.allSettled([searchFT(params), searchAZ(params), searchJB(params)])
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `npx vitest run src/lib/collector/collect.test.ts`
Expected: PASS.

- [ ] **Step 5: Vérifier la suite complète et le build**

Run: `npx vitest run src/lib/collector/ && npx next build`
Expected: tous les tests du collecteur passent, build réussi.

- [ ] **Step 6: Commit**

```bash
git add src/lib/collector/collect.ts src/lib/collector/collect.test.ts
git commit -m "feat(collecte): branche Jooble comme 3e source du collecteur

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes hors code (opérationnel, pas dans les tâches)

- Adzuna : ajouter `ADZUNA_APP_ID` et `ADZUNA_APP_KEY` en local (fait) et sur Render (Environment).
- Jooble : obtenir la clé sur https://jooble.org/api/about, la mettre dans `JOOBLE_API_KEY` (local + Render).
- Sans ces clés, la source concernée échoue proprement (captée par `Promise.allSettled`) et les autres sources fonctionnent.
