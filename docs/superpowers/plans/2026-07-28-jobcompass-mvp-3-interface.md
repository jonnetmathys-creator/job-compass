# JobCompass MVP Brique 3 : l'Interface · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire l'interface JobCompass : accueil moteur de recherche, écran résultats split (liste + carte Leaflet), page offre dédiée, système de favoris (like) et espace compte, branchés sur le collecteur existant.

**Architecture:** Next.js 16 App Router. Les pages serveur lisent Supabase (session utilisateur, RLS) et délèguent l'affichage à des composants clients. Les collectes et écritures passent par des Server Actions (`'use server'`) authentifiées par la session, réutilisant `collectForRecherche` (Brique 2) via le client service. La carte utilise Leaflet en vanilla (import dynamique `ssr:false`) + `leaflet.markercluster`. Le rendu visuel reproduit la maquette de référence `docs/superpowers/specs/mockups/interface-mockup.html`.

**Tech Stack:** Next.js 16.2.12, React 19, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Leaflet 1.9 + leaflet.markercluster, Tailwind v4, Vitest + @testing-library/react.

## Global Constraints

- **Jamais de tiret cadratin** dans le contenu affiché ou les commentaires : remplacer par `:`, `,` ou `·`.
- **Textes en français.**
- **Next.js 16** : `middleware.ts` est renommé `proxy.ts` (déjà en place). Lire `node_modules/next/dist/docs/` avant d'utiliser une API Next incertaine.
- **Client navigateur Supabase** : toujours référencer `process.env.NEXT_PUBLIC_*` en accès statique (Next n'inline que les accès statiques). Utiliser `getBrowserClient()` existant.
- **RLS** : les offres sont mutualisées (lecture par tout authentifié) ; `recherches`, `resultats`, `favoris` sont propres à l'utilisateur. Les Server Actions vérifient la session via `getServerClient()` et n'utilisent `getServiceClient()` que pour la collecte.
- **Accent vert** `#2e9e5b` (variable `--accent`), `--accent-soft` `#e7f5ec`, cœur de like rouge doux `#e2565b`. Arrondis généreux, ombres douces, Montserrat.
- **Tri des offres** : par `date_publication` décroissante, dates nulles en fin. Pas de scoring.
- **Rayon par défaut** : France entière (aucun km tant qu'aucun lieu saisi).
- **Référence visuelle** : `docs/superpowers/specs/mockups/interface-mockup.html`. Reproduire son markup/CSS/animations. Les classes CSS nommées ci-dessous doivent être portées dans `src/app/globals.css` depuis la maquette.
- **Tests** : colocalisés (`*.test.ts`/`*.test.tsx`), `npm test` (Vitest, jsdom). Ne pas ajouter de test dans `tests/**` (réservé RLS, exclu par défaut).
- **Commits fréquents**, un par étape de commit.

## File Structure

**Migration / données**
- `supabase/migrations/0002_favoris_logo.sql` : table `favoris` + colonne `offres.entreprise_logo` + RLS favoris.
- `src/lib/collector/types.ts` (modifier) : ajouter `entreprise_logo` à `NormalizedOffer`.
- `src/lib/collector/france-travail.ts` (modifier) : capter `raw.entreprise?.logo`.
- `src/lib/collector/store.ts` (modifier) : insérer `entreprise_logo`.

**Lib**
- `src/lib/offres/types.ts` : type `OffreRow` partagé (lecture UI).
- `src/lib/recherche/offres.ts` : `getRecherche`, `getOffresForRecherche` (tri date).
- `src/lib/geo/adresse.ts` : `geocodeCommune`.
- `src/lib/geo/departements.ts` : `PREFECTURES`, `positionEpingle`.
- `src/lib/recherche/actions.ts` : Server Actions `lancerRecherche`, `affinerLieu`.
- `src/lib/favoris/actions.ts` : Server Action `toggleFavori`.
- `src/lib/favoris/lecture.ts` : `getFavoriIds`, `getFavoris`.

**Pages**
- `src/app/page.tsx` (remplacer) : accueil recherche.
- `src/app/recherche/[id]/page.tsx` : écran résultats (serveur).
- `src/app/offre/[id]/page.tsx` : page offre (serveur).
- `src/app/profil/page.tsx` (modifier) : ajouter les offres likées.

**Composants** (`src/components/`)
- `search-bar.tsx` : barre + titre animé + placeholder animé.
- `resultats-shell.tsx` : layout split, état (filtre contrat, repli, expand, likes), coordination liste↔carte.
- `filtres-bar.tsx` : poste, lieu, rayon, contrat.
- `offre-liste.tsx`, `offre-card.tsx` : liste + carte accordéon + like.
- `carte-offres.tsx` : Leaflet + clustering + mini-preview.
- `like-bouton.tsx` : cœur + animation pop.
- `compte-menu.tsx` : espace compte global.

**Styles**
- `src/app/globals.css` (modifier) : classes portées de la maquette.
- `src/app/layout.tsx` (modifier) : Montserrat + graisses 800 et italique ; inclure `<CompteMenu/>` global.

---

## Task 1: Migration favoris + logo employeur

**Files:**
- Create: `supabase/migrations/0002_favoris_logo.sql`
- Modify: `src/lib/collector/types.ts` (NormalizedOffer)
- Modify: `src/lib/collector/france-travail.ts:19-34` (normalizeFtOffre)
- Modify: `src/lib/collector/store.ts` (insert offres)
- Test: `src/lib/collector/france-travail.test.ts` (ajout d'un cas)

**Interfaces:**
- Produces: table `favoris(user_id uuid, offre_id uuid, created_at timestamptz, primary key(user_id,offre_id))` ; colonne `offres.entreprise_logo text`. `NormalizedOffer.entreprise_logo: string | null`.

- [ ] **Step 1: Écrire la migration SQL**

Create `supabase/migrations/0002_favoris_logo.sql` :

```sql
-- Logo employeur (URL) fourni par la source, nullable
alter table public.offres add column if not exists entreprise_logo text;

-- Favoris : offres likées par un utilisateur
create table if not exists public.favoris (
  user_id uuid not null references auth.users(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, offre_id)
);

alter table public.favoris enable row level security;

-- Chacun ne voit et ne gère que ses favoris
create policy favoris_self on public.favoris
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Ajouter `entreprise_logo` au type NormalizedOffer**

In `src/lib/collector/types.ts`, add the field to `NormalizedOffer` after `entreprise`:

```ts
  entreprise: string | null
  entreprise_logo: string | null
```

- [ ] **Step 3: Écrire le test de normalisation du logo**

In `src/lib/collector/france-travail.test.ts`, add:

```ts
import { normalizeFtOffre } from './france-travail'

test('normalizeFtOffre capte le logo entreprise quand présent', () => {
  const o = normalizeFtOffre({ id: '1', intitule: 'X', entreprise: { nom: 'ACME', logo: 'https://x/logo.png' } })
  expect(o.entreprise_logo).toBe('https://x/logo.png')
})

test('normalizeFtOffre met entreprise_logo à null si absent', () => {
  const o = normalizeFtOffre({ id: '2', intitule: 'Y', entreprise: { nom: 'ACME' } })
  expect(o.entreprise_logo).toBeNull()
})
```

- [ ] **Step 4: Run test, vérifier l'échec**

Run: `npm test -- france-travail`
Expected: FAIL (propriété `entreprise_logo` inexistante / undefined).

- [ ] **Step 5: Capter le logo dans le normaliseur**

In `src/lib/collector/france-travail.ts`, inside `normalizeFtOffre`, add after `entreprise:` line:

```ts
    entreprise: raw.entreprise?.nom ?? null,
    entreprise_logo: raw.entreprise?.logo ?? null,
```

- [ ] **Step 6: Insérer le logo au stockage**

In `src/lib/collector/store.ts`, inside `storeOffres`, add `entreprise_logo` to the object mapped for upsert (mirror the existing `entreprise` field). Read the file first; add `entreprise_logo: o.entreprise_logo` to the row built for each offer.

- [ ] **Step 7: Run tests**

Run: `npm test -- france-travail`
Expected: PASS.

- [ ] **Step 8: Appliquer la migration (note pour l'exécutant)**

La migration doit être appliquée sur Supabase distant par le partenaire humain (SQL editor) avant la validation E2E. Signaler dans le rapport que `0002_favoris_logo.sql` est à exécuter. Ne pas bloquer les tâches suivantes (elles n'en dépendent pas pour les tests unitaires).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0002_favoris_logo.sql src/lib/collector/types.ts src/lib/collector/france-travail.ts src/lib/collector/store.ts src/lib/collector/france-travail.test.ts
git commit -m "feat(db): table favoris + colonne entreprise_logo, captée à la collecte"
```

---

## Task 2: Lecture des offres d'une recherche (tri par date)

**Files:**
- Create: `src/lib/offres/types.ts`
- Create: `src/lib/recherche/offres.ts`
- Test: `src/lib/recherche/offres.test.ts`

**Interfaces:**
- Produces:
  - `type OffreRow = { id: string; source: string; source_id: string; titre: string; entreprise: string | null; entreprise_logo: string | null; description: string | null; contrat: string | null; salaire: string | null; latitude: number | null; longitude: number | null; ville: string | null; url_postuler: string | null; email_contact: string | null; date_publication: string | null }`
  - `getRecherche(client, id): Promise<{ id: string; intitule: string; localisation: string | null; rayon_km: number | null; type_contrat: string | null } | null>`
  - `getOffresForRecherche(client, rechercheId): Promise<OffreRow[]>` triées par `date_publication` desc, nulls en fin.
  - `sortByDateDesc(offres: OffreRow[]): OffreRow[]` (exportée, pure, testable).

- [ ] **Step 1: Définir le type OffreRow**

Create `src/lib/offres/types.ts` :

```ts
export type OffreRow = {
  id: string
  source: string
  source_id: string
  titre: string
  entreprise: string | null
  entreprise_logo: string | null
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

export const OFFRE_COLUMNS =
  'id, source, source_id, titre, entreprise, entreprise_logo, description, contrat, salaire, latitude, longitude, ville, url_postuler, email_contact, date_publication'
```

- [ ] **Step 2: Écrire le test du tri**

Create `src/lib/recherche/offres.test.ts` :

```ts
import { sortByDateDesc } from './offres'
import type { OffreRow } from '@/lib/offres/types'

const base: Omit<OffreRow, 'id' | 'date_publication'> = {
  source: 'france_travail', source_id: 'x', titre: 't', entreprise: null, entreprise_logo: null,
  description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: null,
  url_postuler: null, email_contact: null,
}
const o = (id: string, d: string | null): OffreRow => ({ ...base, id, date_publication: d })

test('trie par date de publication décroissante', () => {
  const out = sortByDateDesc([o('a', '2026-01-01'), o('b', '2026-03-01'), o('c', '2026-02-01')])
  expect(out.map((x) => x.id)).toEqual(['b', 'c', 'a'])
})

test('place les dates nulles en fin', () => {
  const out = sortByDateDesc([o('a', null), o('b', '2026-01-01'), o('c', null)])
  expect(out.map((x) => x.id)).toEqual(['b', 'a', 'c'])
})
```

- [ ] **Step 3: Run test, vérifier l'échec**

Run: `npm test -- recherche/offres`
Expected: FAIL (`sortByDateDesc` introuvable).

- [ ] **Step 4: Implémenter la lecture + le tri**

Create `src/lib/recherche/offres.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'

export function sortByDateDesc(offres: OffreRow[]): OffreRow[] {
  return [...offres].sort((a, b) => {
    if (!a.date_publication && !b.date_publication) return 0
    if (!a.date_publication) return 1
    if (!b.date_publication) return -1
    return b.date_publication.localeCompare(a.date_publication)
  })
}

export async function getRecherche(client: SupabaseClient, id: string) {
  const { data } = await client
    .from('recherches')
    .select('id, intitule, localisation, rayon_km, type_contrat')
    .eq('id', id)
    .single()
  return data as
    | { id: string; intitule: string; localisation: string | null; rayon_km: number | null; type_contrat: string | null }
    | null
}

export async function getOffresForRecherche(client: SupabaseClient, rechercheId: string): Promise<OffreRow[]> {
  const { data, error } = await client
    .from('resultats')
    .select(`offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('recherche_id', rechercheId)
  if (error || !data) return []
  const offres = data.map((r: { offres: OffreRow | OffreRow[] }) => (Array.isArray(r.offres) ? r.offres[0] : r.offres)).filter(Boolean) as OffreRow[]
  return sortByDateDesc(offres)
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- recherche/offres`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/offres/types.ts src/lib/recherche/offres.ts src/lib/recherche/offres.test.ts
git commit -m "feat(offres): lecture des offres d'une recherche, triées par date"
```

---

## Task 3: Géocodage ville + repli département → préfecture

**Files:**
- Create: `src/lib/geo/adresse.ts`
- Create: `src/lib/geo/departements.ts`
- Test: `src/lib/geo/adresse.test.ts`, `src/lib/geo/departements.test.ts`

**Interfaces:**
- Produces:
  - `geocodeCommune(query: string, fetchImpl?: typeof fetch): Promise<{ insee: string; lat: number; lng: number; label: string } | null>`
  - `PREFECTURES: Record<string, { lat: number; lng: number; nom: string }>` (clé = code département)
  - `codeDepartement(offre: { ville: string | null }): string | null`
  - `positionEpingle(offre: { latitude: number | null; longitude: number | null; ville: string | null }): { lat: number; lng: number } | null`

- [ ] **Step 1: Écrire le test du géocodage**

Create `src/lib/geo/adresse.test.ts` :

```ts
import { geocodeCommune } from './adresse'

function fakeFetch(json: unknown): typeof fetch {
  return (async () => ({ ok: true, json: async () => json })) as unknown as typeof fetch
}

test('extrait code INSEE et coordonnées de la 1re proposition', async () => {
  const res = await geocodeCommune('Nantes', fakeFetch({
    features: [{ geometry: { coordinates: [-1.5536, 47.2184] }, properties: { citycode: '44109', label: 'Nantes' } }],
  }))
  expect(res).toEqual({ insee: '44109', lat: 47.2184, lng: -1.5536, label: 'Nantes' })
})

test('renvoie null quand aucune proposition', async () => {
  const res = await geocodeCommune('zzz', fakeFetch({ features: [] }))
  expect(res).toBeNull()
})
```

- [ ] **Step 2: Run test, vérifier l'échec**

Run: `npm test -- geo/adresse`
Expected: FAIL (`geocodeCommune` introuvable).

- [ ] **Step 3: Implémenter le géocodage**

Create `src/lib/geo/adresse.ts` :

```ts
const BASE = 'https://api-adresse.data.gouv.fr/search/'

export async function geocodeCommune(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ insee: string; lat: number; lng: number; label: string } | null> {
  const url = `${BASE}?q=${encodeURIComponent(query)}&type=municipality&limit=1`
  const res = await fetchImpl(url)
  if (!res.ok) return null
  const json = (await res.json()) as {
    features?: { geometry: { coordinates: [number, number] }; properties: { citycode: string; label: string } }[]
  }
  const f = json.features?.[0]
  if (!f) return null
  return { insee: f.properties.citycode, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], label: f.properties.label }
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- geo/adresse`
Expected: PASS.

- [ ] **Step 5: Écrire le test du repli d'épingle**

Create `src/lib/geo/departements.test.ts` :

```ts
import { codeDepartement, positionEpingle, PREFECTURES } from './departements'

test('lit le code département depuis un libellé "44 - NANTES"', () => {
  expect(codeDepartement({ ville: '44 - NANTES' })).toBe('44')
})

test('gère la Corse "2A - AJACCIO"', () => {
  expect(codeDepartement({ ville: '2A - AJACCIO' })).toBe('2A')
})

test('renvoie null si aucun code lisible', () => {
  expect(codeDepartement({ ville: 'Nantes' })).toBeNull()
  expect(codeDepartement({ ville: null })).toBeNull()
})

test('positionEpingle : coordonnées réelles prioritaires', () => {
  expect(positionEpingle({ latitude: 47.1, longitude: -1.5, ville: '44 - NANTES' })).toEqual({ lat: 47.1, lng: -1.5 })
})

test('positionEpingle : repli sur la préfecture du département', () => {
  const pos = positionEpingle({ latitude: null, longitude: null, ville: '44 - NANTES' })
  expect(pos).toEqual({ lat: PREFECTURES['44'].lat, lng: PREFECTURES['44'].lng })
})

test('positionEpingle : null si ni coords ni département', () => {
  expect(positionEpingle({ latitude: null, longitude: null, ville: 'Lieu inconnu' })).toBeNull()
})
```

- [ ] **Step 6: Run test, vérifier l'échec**

Run: `npm test -- geo/departements`
Expected: FAIL (module introuvable).

- [ ] **Step 7: Implémenter la table préfectures + le repli**

Create `src/lib/geo/departements.ts`. La table `PREFECTURES` couvre les 101 départements (métropole + DOM), coordonnées de la préfecture (précision au centième suffisante pour un repli). Copier ce littéral complet :

```ts
export const PREFECTURES: Record<string, { lat: number; lng: number; nom: string }> = {
  '01': { lat: 46.20, lng: 5.23, nom: 'Bourg-en-Bresse' },
  '02': { lat: 49.56, lng: 3.62, nom: 'Laon' },
  '03': { lat: 46.57, lng: 3.33, nom: 'Moulins' },
  '04': { lat: 44.09, lng: 6.24, nom: 'Digne-les-Bains' },
  '05': { lat: 44.56, lng: 6.08, nom: 'Gap' },
  '06': { lat: 43.70, lng: 7.27, nom: 'Nice' },
  '07': { lat: 44.74, lng: 4.60, nom: 'Privas' },
  '08': { lat: 49.77, lng: 4.72, nom: 'Charleville-Mézières' },
  '09': { lat: 42.96, lng: 1.61, nom: 'Foix' },
  '10': { lat: 48.30, lng: 4.07, nom: 'Troyes' },
  '11': { lat: 43.21, lng: 2.35, nom: 'Carcassonne' },
  '12': { lat: 44.35, lng: 2.57, nom: 'Rodez' },
  '13': { lat: 43.30, lng: 5.37, nom: 'Marseille' },
  '14': { lat: 49.18, lng: -0.37, nom: 'Caen' },
  '15': { lat: 44.93, lng: 2.44, nom: 'Aurillac' },
  '16': { lat: 45.65, lng: 0.16, nom: 'Angoulême' },
  '17': { lat: 46.16, lng: -1.15, nom: 'La Rochelle' },
  '18': { lat: 47.08, lng: 2.40, nom: 'Bourges' },
  '19': { lat: 45.27, lng: 1.77, nom: 'Tulle' },
  '2A': { lat: 41.93, lng: 8.74, nom: 'Ajaccio' },
  '2B': { lat: 42.70, lng: 9.45, nom: 'Bastia' },
  '21': { lat: 47.32, lng: 5.04, nom: 'Dijon' },
  '22': { lat: 48.51, lng: -2.77, nom: 'Saint-Brieuc' },
  '23': { lat: 46.17, lng: 1.87, nom: 'Guéret' },
  '24': { lat: 45.18, lng: 0.72, nom: 'Périgueux' },
  '25': { lat: 47.24, lng: 6.02, nom: 'Besançon' },
  '26': { lat: 44.93, lng: 4.89, nom: 'Valence' },
  '27': { lat: 49.02, lng: 1.15, nom: 'Évreux' },
  '28': { lat: 48.44, lng: 1.49, nom: 'Chartres' },
  '29': { lat: 48.39, lng: -4.49, nom: 'Quimper' },
  '30': { lat: 43.84, lng: 4.36, nom: 'Nîmes' },
  '31': { lat: 43.60, lng: 1.44, nom: 'Toulouse' },
  '32': { lat: 43.65, lng: 0.59, nom: 'Auch' },
  '33': { lat: 44.84, lng: -0.58, nom: 'Bordeaux' },
  '34': { lat: 43.61, lng: 3.88, nom: 'Montpellier' },
  '35': { lat: 48.11, lng: -1.68, nom: 'Rennes' },
  '36': { lat: 46.81, lng: 1.69, nom: 'Châteauroux' },
  '37': { lat: 47.39, lng: 0.69, nom: 'Tours' },
  '38': { lat: 45.19, lng: 5.72, nom: 'Grenoble' },
  '39': { lat: 46.67, lng: 5.55, nom: 'Lons-le-Saunier' },
  '40': { lat: 43.89, lng: -0.50, nom: 'Mont-de-Marsan' },
  '41': { lat: 47.59, lng: 1.33, nom: 'Blois' },
  '42': { lat: 45.44, lng: 4.39, nom: 'Saint-Étienne' },
  '43': { lat: 45.04, lng: 3.88, nom: 'Le Puy-en-Velay' },
  '44': { lat: 47.22, lng: -1.55, nom: 'Nantes' },
  '45': { lat: 47.90, lng: 1.90, nom: 'Orléans' },
  '46': { lat: 44.45, lng: 1.44, nom: 'Cahors' },
  '47': { lat: 44.20, lng: 0.62, nom: 'Agen' },
  '48': { lat: 44.52, lng: 3.50, nom: 'Mende' },
  '49': { lat: 47.47, lng: -0.55, nom: 'Angers' },
  '50': { lat: 49.12, lng: -1.09, nom: 'Saint-Lô' },
  '51': { lat: 48.96, lng: 4.36, nom: 'Châlons-en-Champagne' },
  '52': { lat: 48.11, lng: 5.14, nom: 'Chaumont' },
  '53': { lat: 48.07, lng: -0.77, nom: 'Laval' },
  '54': { lat: 48.69, lng: 6.18, nom: 'Nancy' },
  '55': { lat: 48.77, lng: 5.16, nom: 'Bar-le-Duc' },
  '56': { lat: 47.66, lng: -2.76, nom: 'Vannes' },
  '57': { lat: 49.12, lng: 6.18, nom: 'Metz' },
  '58': { lat: 46.99, lng: 3.16, nom: 'Nevers' },
  '59': { lat: 50.63, lng: 3.06, nom: 'Lille' },
  '60': { lat: 49.42, lng: 2.83, nom: 'Beauvais' },
  '61': { lat: 48.43, lng: 0.09, nom: 'Alençon' },
  '62': { lat: 50.29, lng: 2.78, nom: 'Arras' },
  '63': { lat: 45.78, lng: 3.09, nom: 'Clermont-Ferrand' },
  '64': { lat: 43.30, lng: -0.37, nom: 'Pau' },
  '65': { lat: 43.23, lng: 0.08, nom: 'Tarbes' },
  '66': { lat: 42.70, lng: 2.89, nom: 'Perpignan' },
  '67': { lat: 48.58, lng: 7.75, nom: 'Strasbourg' },
  '68': { lat: 47.75, lng: 7.34, nom: 'Colmar' },
  '69': { lat: 45.76, lng: 4.84, nom: 'Lyon' },
  '70': { lat: 47.62, lng: 6.15, nom: 'Vesoul' },
  '71': { lat: 46.78, lng: 4.85, nom: 'Mâcon' },
  '72': { lat: 48.00, lng: 0.20, nom: 'Le Mans' },
  '73': { lat: 45.57, lng: 5.92, nom: 'Chambéry' },
  '74': { lat: 45.90, lng: 6.13, nom: 'Annecy' },
  '75': { lat: 48.86, lng: 2.35, nom: 'Paris' },
  '76': { lat: 49.44, lng: 1.10, nom: 'Rouen' },
  '77': { lat: 48.54, lng: 2.66, nom: 'Melun' },
  '78': { lat: 48.80, lng: 2.13, nom: 'Versailles' },
  '79': { lat: 46.32, lng: -0.46, nom: 'Niort' },
  '80': { lat: 49.89, lng: 2.30, nom: 'Amiens' },
  '81': { lat: 43.93, lng: 2.15, nom: 'Albi' },
  '82': { lat: 44.02, lng: 1.35, nom: 'Montauban' },
  '83': { lat: 43.12, lng: 5.93, nom: 'Toulon' },
  '84': { lat: 43.95, lng: 4.81, nom: 'Avignon' },
  '85': { lat: 46.67, lng: -1.43, nom: 'La Roche-sur-Yon' },
  '86': { lat: 46.58, lng: 0.34, nom: 'Poitiers' },
  '87': { lat: 45.83, lng: 1.26, nom: 'Limoges' },
  '88': { lat: 48.17, lng: 6.45, nom: 'Épinal' },
  '89': { lat: 47.80, lng: 3.57, nom: 'Auxerre' },
  '90': { lat: 47.64, lng: 6.86, nom: 'Belfort' },
  '91': { lat: 48.63, lng: 2.44, nom: 'Évry' },
  '92': { lat: 48.90, lng: 2.24, nom: 'Nanterre' },
  '93': { lat: 48.91, lng: 2.44, nom: 'Bobigny' },
  '94': { lat: 48.79, lng: 2.46, nom: 'Créteil' },
  '95': { lat: 49.04, lng: 2.08, nom: 'Cergy' },
  '971': { lat: 16.24, lng: -61.53, nom: 'Basse-Terre' },
  '972': { lat: 14.60, lng: -61.07, nom: 'Fort-de-France' },
  '973': { lat: 4.94, lng: -52.33, nom: 'Cayenne' },
  '974': { lat: -20.88, lng: 55.45, nom: 'Saint-Denis' },
  '976': { lat: -12.78, lng: 45.23, nom: 'Mamoudzou' },
}

// "44 - NANTES" -> "44" ; "2A - AJACCIO" -> "2A" ; "971 - ..." -> "971"
export function codeDepartement(offre: { ville: string | null }): string | null {
  if (!offre.ville) return null
  const m = offre.ville.trim().match(/^(2[AB]|9\d{2}|\d{2})\b/)
  return m ? m[1] : null
}

export function positionEpingle(
  offre: { latitude: number | null; longitude: number | null; ville: string | null },
): { lat: number; lng: number } | null {
  if (offre.latitude != null && offre.longitude != null) return { lat: offre.latitude, lng: offre.longitude }
  const dep = codeDepartement(offre)
  if (dep && PREFECTURES[dep]) return { lat: PREFECTURES[dep].lat, lng: PREFECTURES[dep].lng }
  return null
}
```

- [ ] **Step 8: Run tests**

Run: `npm test -- geo/departements`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/geo/adresse.ts src/lib/geo/departements.ts src/lib/geo/adresse.test.ts src/lib/geo/departements.test.ts
git commit -m "feat(geo): géocodage commune + repli épingle département/préfecture"
```

---

## Task 4: Server Actions recherche + favoris

**Files:**
- Create: `src/lib/recherche/actions.ts`
- Create: `src/lib/favoris/actions.ts`
- Create: `src/lib/favoris/lecture.ts`
- Test: `src/lib/recherche/actions.test.ts`, `src/lib/favoris/lecture.test.ts`

**Interfaces:**
- Consumes: `getServerClient()` (`@/lib/supabase/server`), `getServiceClient()` (`@/lib/supabase/service`), `collectForRecherche` (`@/lib/collector/collect`), `geocodeCommune` (`@/lib/geo/adresse`), `getOffresForRecherche` + `OFFRE_COLUMNS`.
- Produces:
  - `buildRechercheInsert(userId: string, poste: string): { user_id: string; intitule: string; mots_cles: string[]; localisation: null; rayon_km: null; type_contrat: null }` (pure, exportée, testable)
  - Server Action `lancerRecherche(poste: string): Promise<void>` (crée la recherche, collecte, `redirect`)
  - Server Action `affinerLieu(rechercheId: string, ville: string, rayonKm: number | null): Promise<{ ok: boolean; erreur?: string }>`
  - Server Action `toggleFavori(offreId: string): Promise<{ liked: boolean }>`
  - `getFavoriIds(client, userId): Promise<string[]>`
  - `getFavoris(client, userId): Promise<OffreRow[]>`

- [ ] **Step 1: Écrire le test de `buildRechercheInsert`**

Create `src/lib/recherche/actions.test.ts` :

```ts
import { buildRechercheInsert } from './actions'

test('construit la ligne recherche : poste en intitulé et mot-clé, localisation nulle', () => {
  const row = buildRechercheInsert('user-1', '  Diététicien ')
  expect(row).toEqual({
    user_id: 'user-1', intitule: 'Diététicien', mots_cles: ['Diététicien'],
    localisation: null, rayon_km: null, type_contrat: null,
  })
})
```

- [ ] **Step 2: Run test, vérifier l'échec**

Run: `npm test -- recherche/actions`
Expected: FAIL (`buildRechercheInsert` introuvable).

- [ ] **Step 3: Implémenter les Server Actions recherche**

Create `src/lib/recherche/actions.ts` :

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/service'
import { collectForRecherche } from '@/lib/collector/collect'
import { geocodeCommune } from '@/lib/geo/adresse'
import type { RechercheRow } from '@/lib/collector/types'

export function buildRechercheInsert(userId: string, poste: string) {
  const p = poste.trim()
  return { user_id: userId, intitule: p, mots_cles: [p], localisation: null, rayon_km: null, type_contrat: null } as const
}

export async function lancerRecherche(poste: string): Promise<void> {
  const p = poste.trim()
  if (!p) return
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await supabase
    .from('recherches')
    .insert(buildRechercheInsert(user.id, p))
    .select('id')
    .single()
  if (error || !data) throw new Error('Création de la recherche impossible')
  const service = getServiceClient()
  const recherche: RechercheRow & { id: string } = {
    id: data.id, mots_cles: [p], localisation: null, rayon_km: null, type_contrat: null,
  }
  await collectForRecherche(service, recherche)
  redirect(`/recherche/${data.id}`)
}

export async function affinerLieu(
  rechercheId: string, ville: string, rayonKm: number | null,
): Promise<{ ok: boolean; erreur?: string }> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erreur: 'Non authentifié' }
  const geo = ville.trim() ? await geocodeCommune(ville) : null
  if (ville.trim() && !geo) return { ok: false, erreur: 'Lieu introuvable, précisez la commune.' }
  const { data: rech } = await supabase
    .from('recherches')
    .update({ localisation: geo ? geo.insee : null, rayon_km: rayonKm })
    .eq('id', rechercheId)
    .select('id, mots_cles, localisation, rayon_km, type_contrat')
    .single()
  if (!rech) return { ok: false, erreur: 'Recherche introuvable' }
  const service = getServiceClient()
  await collectForRecherche(service, rech as RechercheRow & { id: string })
  revalidatePath(`/recherche/${rechercheId}`)
  return { ok: true }
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- recherche/actions`
Expected: PASS.

- [ ] **Step 5: Écrire le test de lecture des favoris**

Create `src/lib/favoris/lecture.test.ts` :

```ts
import { getFavoriIds } from './lecture'

test('getFavoriIds renvoie la liste des offre_id likées', async () => {
  const client = {
    from: () => ({ select: () => ({ eq: async () => ({ data: [{ offre_id: 'a' }, { offre_id: 'b' }], error: null }) }) }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient
  expect(await getFavoriIds(client, 'user-1')).toEqual(['a', 'b'])
})

test('getFavoriIds renvoie [] en cas d’erreur', async () => {
  const client = {
    from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'x' } }) }) }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient
  expect(await getFavoriIds(client, 'user-1')).toEqual([])
})
```

- [ ] **Step 6: Run test, vérifier l'échec**

Run: `npm test -- favoris/lecture`
Expected: FAIL.

- [ ] **Step 7: Implémenter la lecture des favoris**

Create `src/lib/favoris/lecture.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import { sortByDateDesc } from '@/lib/recherche/offres'

export async function getFavoriIds(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from('favoris').select('offre_id').eq('user_id', userId)
  if (error || !data) return []
  return data.map((r: { offre_id: string }) => r.offre_id)
}

export async function getFavoris(client: SupabaseClient, userId: string): Promise<OffreRow[]> {
  const { data, error } = await client
    .from('favoris')
    .select(`offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('user_id', userId)
  if (error || !data) return []
  const offres = data
    .map((r: { offres: OffreRow | OffreRow[] }) => (Array.isArray(r.offres) ? r.offres[0] : r.offres))
    .filter(Boolean) as OffreRow[]
  return sortByDateDesc(offres)
}
```

- [ ] **Step 8: Implémenter la Server Action toggleFavori**

Create `src/lib/favoris/actions.ts` :

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { getFavoriIds } from './lecture'

export async function toggleFavori(offreId: string): Promise<{ liked: boolean }> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const ids = await getFavoriIds(supabase, user.id)
  const already = ids.includes(offreId)
  if (already) {
    await supabase.from('favoris').delete().eq('user_id', user.id).eq('offre_id', offreId)
  } else {
    await supabase.from('favoris').insert({ user_id: user.id, offre_id: offreId })
  }
  revalidatePath('/profil')
  return { liked: !already }
}
```

- [ ] **Step 9: Run tests**

Run: `npm test -- favoris`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/recherche/actions.ts src/lib/favoris/actions.ts src/lib/favoris/lecture.ts src/lib/recherche/actions.test.ts src/lib/favoris/lecture.test.ts
git commit -m "feat(actions): Server Actions recherche (lancer/affiner) et favoris (toggle/lecture)"
```

---

## Task 5: Styles globaux + layout (Montserrat 800/italique, dépendances Leaflet)

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/proxy.ts` (matcher)
- Modify: `package.json` (dépendances Leaflet)

**Interfaces:**
- Produces: classes CSS globales portées de la maquette (`.card`, `.tag`, `.like`, `.pin`, `.cluster-pin`, `.map-toggle`, `.btn-apply`, `.btn-future`, `.btn-save`, `.account`, `.acc-menu`, `.detail-*`, `.mp-*`, `.headline .word`, etc.) ; police Montserrat avec graisses 400-800 + italique ; routes `/recherche` et `/offre` protégées.

- [ ] **Step 1: Installer Leaflet + clustering**

Run:
```bash
npm install leaflet@^1.9.4 leaflet.markercluster@^1.5.3
npm install -D @types/leaflet@^1.9.12 @types/leaflet.markercluster@^1.5.4
```

- [ ] **Step 2: Étendre la police Montserrat**

In `src/app/layout.tsx`, update the font config to include weight `800` and italic, and mount the global account menu:

```tsx
import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'
import CompteMenu from '@/components/compte-menu'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'JobCompass',
  description: 'Centralisez et envoyez vos candidatures en diététique.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body>
        <CompteMenu />
        {children}
      </body>
    </html>
  )
}
```

Note : `CompteMenu` est créé en Task 10. Tant qu'il n'existe pas, l'import cassera le build ; l'implémenteur de Task 5 crée un **stub minimal** `src/components/compte-menu.tsx` qui exporte `export default function CompteMenu() { return null }` (remplacé en Task 10).

- [ ] **Step 3: Porter les classes CSS de la maquette**

In `src/app/globals.css`, after the existing `:root`/`body` block, append the component classes from the reference mockup `docs/superpowers/specs/mockups/interface-mockup.html` (the `<style>` block). Port verbatim (en adaptant les variables déjà présentes `--accent`, `--accent-soft`, `--ink`) toutes les règles de : `.logo`, `.hero`, `.headline`/`.word`, `.searchbar`, `.btn-primary`, `.decor`/`.blob`/`.ring`/`.compass`/`.dotgrid`, `.topbar`/`.poste-chip`/`.field`/`.count`, `.split`/`.list-pane`/`.map-pane`/`.map-toggle`, `.card`/`.tag`/`.preview`/`.btn-more`/`.like`(+`@keyframes heartpop`/`heartburst`), `.pin`/`.cluster-pin`/`.marker-cluster`, `.leaflet-popup-*`/`.mp-*`, `.btn-apply`/`.btn-future`/`.btn-save`, `.detail-*`/`.side-*`/`.d-*`, `.account`/`.avatar-btn`/`.ava`/`.acc-menu`/`.acc-*`, `.profil-*`/`.liked-*`, plus `@keyframes rise`/`cardin` et la règle `prefers-reduced-motion`. Ajouter aussi la variable `--accent-dark:#248049;`, `--muted`, `--line`, `--card`, `--shadow-*`, `--radius`, `--radius-lg` au `:root` (copier depuis la maquette).

**Ne PAS porter les classes propres à la maquette** (elles servaient uniquement à la démo à onglets) : `.switch`, `.tagm`, `.screen`, ni les règles de bascule `#accueil`/`#accueil.on`/`#resultats`/`#resultats.on`/`#offre`/`#profil`. Les pages réelles portent leur mise en page via styles inline + classes de composant (`.hero`, `.topbar`, `.split`, `.detail-*`, etc.).

- [ ] **Step 4: Protéger les nouvelles routes**

In `src/proxy.ts`, update the protected list and matcher to include `/recherche` and `/offre` :

```ts
  const isProtected = ['/profil', '/offres', '/recherche', '/offre'].some((p) =>
    request.nextUrl.pathname.startsWith(p))
```
```ts
export const config = { matcher: ['/profil/:path*', '/offres/:path*', '/recherche/:path*', '/offre/:path*'] }
```

- [ ] **Step 5: Vérifier le build**

Run: `npm run build`
Expected: build réussi (les pages existantes compilent ; le stub CompteMenu ne casse rien).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app/layout.tsx src/app/globals.css src/proxy.ts src/components/compte-menu.tsx
git commit -m "chore(ui): Leaflet, Montserrat 800/italique, styles portés de la maquette, routes protégées"
```

---

## Task 6: Accueil (barre de recherche animée)

**Files:**
- Create: `src/components/search-bar.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/search-bar.test.tsx`

**Interfaces:**
- Consumes: `lancerRecherche` (`@/lib/recherche/actions`), classes `.hero`/`.headline`/`.word`/`.searchbar`/`.btn-primary`/`.decor`.
- Produces: composant `SearchBar` (client) ; accueil rendant le décor vectorisé + `SearchBar`.

- [ ] **Step 1: Écrire le test du composant**

Create `src/components/search-bar.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import SearchBar from './search-bar'

vi.mock('@/lib/recherche/actions', () => ({ lancerRecherche: vi.fn() }))

test('affiche la barre de recherche et un titre', () => {
  render(<SearchBar />)
  expect(screen.getByRole('textbox')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /rechercher/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, vérifier l'échec**

Run: `npm test -- search-bar`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter SearchBar**

Create `src/components/search-bar.tsx`. Client component. Titre tournant mot par mot (slide-up + blur), placeholder animé, soumission qui appelle `lancerRecherche`. Porter la logique JS de la maquette (fonctions `renderHeadline`, rotation, typewriter) en hooks React :

```tsx
'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { lancerRecherche } from '@/lib/recherche/actions'

const PHRASES = [
  'Quel *poste* recherchez-vous ?',
  'Quelle sera votre prochaine *mission* ?',
  'Trouvons votre prochain *poste*.',
  'Prêt·e pour un nouveau *chapitre* ?',
]
const JOBS = ['Diététicien', 'Nutritionniste', 'Conseiller en nutrition', 'Diététicien hospitalier', 'Nutrithérapeute']

export default function SearchBar() {
  const [poste, setPoste] = useState('')
  const [placeholder, setPlaceholder] = useState('Diététicien')
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const [pending, startTransition] = useTransition()

  // titre tournant mot par mot
  useEffect(() => {
    let pi = 0
    const el = headlineRef.current
    if (!el) return
    const render = (text: string) => {
      el.innerHTML = text.split(' ').map((w, i) => {
        const em = w.includes('*'); const clean = w.replace(/\*/g, '')
        return `<span class="word${em ? ' accent' : ''}" style="transition-delay:${i * 75}ms">${clean}</span>`
      }).join(' ')
      requestAnimationFrame(() => requestAnimationFrame(() =>
        el.querySelectorAll('.word').forEach((s) => s.classList.add('show'))))
    }
    render(PHRASES[0])
    const id = setInterval(() => {
      const words = el.querySelectorAll('.word')
      words.forEach((s, i) => { (s as HTMLElement).style.transitionDelay = `${i * 35}ms`; s.classList.remove('show'); s.classList.add('out') })
      setTimeout(() => { pi = (pi + 1) % PHRASES.length; render(PHRASES[pi]) }, 300 + words.length * 35)
    }, 4400)
    return () => clearInterval(id)
  }, [])

  // placeholder machine à écrire
  useEffect(() => {
    let ji = 0, ci = 0, del = false, timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const w = JOBS[ji]
      setPlaceholder(w.slice(0, ci))
      if (!del) { ci++; if (ci > w.length) { del = true; timer = setTimeout(tick, 1300); return } }
      else { ci--; if (ci === 0) { del = false; ji = (ji + 1) % JOBS.length } }
      timer = setTimeout(tick, del ? 45 : 85)
    }
    timer = setTimeout(tick, 600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="hero">
      <div className="logo" style={{ fontSize: 27, marginBottom: 34 }}>Job<span>Compass</span></div>
      <div className="headline"><h1 ref={headlineRef} /></div>
      <form className="searchbar" onSubmit={(e) => { e.preventDefault(); if (poste.trim()) startTransition(() => lancerRecherche(poste)) }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input value={poste} onChange={(e) => setPoste(e.target.value)} placeholder={placeholder} aria-label="Poste recherché" />
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Recherche…' : 'Rechercher'}</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Composer l'accueil**

Replace `src/app/page.tsx`. Page serveur qui redirige vers `/login` si non authentifié, sinon rend le décor + `SearchBar` :

```tsx
import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import SearchBar from '@/components/search-bar'

export default async function Home() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <main style={{ position: 'relative', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, overflow: 'hidden', background: 'radial-gradient(1100px 620px at 50% -12%, var(--accent-soft), transparent 62%)' }}>
      <div className="decor" aria-hidden>
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
        <div className="ring r1" /><div className="ring r2" />
      </div>
      <SearchBar />
    </main>
  )
}
```

Note : porter les éléments décoratifs `.compass`/`.dotgrid` (SVG) depuis la maquette dans le `.decor` si souhaité. L'animation de dérive (anime.js) est optionnelle ; sans elle le décor reste statique et propre. Ne pas ajouter anime.js sauf si l'implémenteur juge l'effet nécessaire (respecter YAGNI).

- [ ] **Step 5: Run test + build**

Run: `npm test -- search-bar && npm run build`
Expected: PASS + build OK.

- [ ] **Step 6: Commit**

```bash
git add src/components/search-bar.tsx src/components/search-bar.test.tsx src/app/page.tsx
git commit -m "feat(accueil): barre de recherche avec titre et placeholder animés"
```

---

## Task 7: Écran résultats (shell split + filtres)

**Files:**
- Create: `src/app/recherche/[id]/page.tsx`
- Create: `src/components/resultats-shell.tsx`
- Create: `src/components/filtres-bar.tsx`
- Test: `src/components/resultats-shell.test.tsx`

**Interfaces:**
- Consumes: `getServerClient`, `getRecherche`, `getOffresForRecherche`, `getFavoriIds`, `affinerLieu`, `OffreRow`.
- Produces:
  - `ResultatsShell` (client) props : `{ recherche: { id: string; intitule: string; localisation: string | null; rayon_km: number | null }; offres: OffreRow[]; favoriIds: string[] }`
  - `FiltresBar` (client) props : `{ poste: string; contrats: string[]; contrat: string; onContrat: (c: string) => void; rechercheId: string }` (le bouton de repli vit dans la carte, cf. Task 9 ; `FiltresBar` porte poste + lieu + rayon + contrat).
  - État partagé exposé aux enfants : `expandedId: string | null`, `likes: Set<string>`, callbacks `onToggleExpand`, `onToggleLike`, `hoveredId`, `onHover`.

- [ ] **Step 1: Écrire le test du shell (filtre contrat)**

Create `src/components/resultats-shell.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResultatsShell from './resultats-shell'
import type { OffreRow } from '@/lib/offres/types'

vi.mock('@/lib/recherche/actions', () => ({ affinerLieu: vi.fn() }))
vi.mock('@/lib/favoris/actions', () => ({ toggleFavori: vi.fn(async () => ({ liked: true })) }))
vi.mock('./carte-offres', () => ({ default: () => <div data-testid="carte" /> }))

const o = (id: string, contrat: string): OffreRow => ({
  id, source: 'ft', source_id: id, titre: `Offre ${id}`, entreprise: 'E', entreprise_logo: null,
  description: 'desc', contrat, salaire: null, latitude: 47, longitude: -1, ville: '44 - NANTES',
  url_postuler: null, email_contact: null, date_publication: '2026-01-01',
})

test('le filtre contrat masque les offres non concernées', async () => {
  render(<ResultatsShell recherche={{ id: 'r1', intitule: 'Diét', localisation: null, rayon_km: null }}
    offres={[o('1', 'CDI'), o('2', 'CDD')]} favoriIds={[]} />)
  expect(screen.getByText('Offre 1')).toBeInTheDocument()
  expect(screen.getByText('Offre 2')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText(/type de contrat/i), 'CDI')
  expect(screen.getByText('Offre 1')).toBeInTheDocument()
  expect(screen.queryByText('Offre 2')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, vérifier l'échec**

Run: `npm test -- resultats-shell`
Expected: FAIL.

- [ ] **Step 3: Implémenter FiltresBar**

Create `src/components/filtres-bar.tsx` :

```tsx
'use client'
import { useState, useTransition } from 'react'
import { affinerLieu } from '@/lib/recherche/actions'

const RAYONS = [
  { label: 'France entière', v: null }, { label: '10 km', v: 10 }, { label: '25 km', v: 25 },
  { label: '50 km', v: 50 }, { label: '100 km', v: 100 },
]

export default function FiltresBar(props: {
  poste: string
  contrats: string[]
  contrat: string
  onContrat: (c: string) => void
  rechercheId: string
}) {
  const [ville, setVille] = useState('')
  const [rayon, setRayon] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  const relancer = () => startTransition(async () => {
    setErreur(null)
    const res = await affinerLieu(props.rechercheId, ville, rayon)
    if (!res.ok) setErreur(res.erreur ?? 'Erreur')
  })

  return (
    <div className="topbar">
      <div className="logo" style={{ fontSize: 19, marginRight: 6 }}>Job<span>Compass</span></div>
      <div className="poste-chip">{props.poste}</div>
      <div className="field">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
        <input value={ville} onChange={(e) => setVille(e.target.value)} onBlur={relancer}
          placeholder="Toute la France" aria-label="Lieu" />
      </div>
      <div className="field">
        <select aria-label="Rayon" value={String(rayon)} onChange={(e) => { const v = e.target.value === 'null' ? null : Number(e.target.value); setRayon(v); relancer() }}>
          {RAYONS.map((r) => <option key={r.label} value={String(r.v)}>{r.label}</option>)}
        </select>
      </div>
      <div className="field">
        <select aria-label="Type de contrat" value={props.contrat} onChange={(e) => props.onContrat(e.target.value)}>
          <option value="">Tous contrats</option>
          {props.contrats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="spacer" />
      {pending && <span className="count">Actualisation…</span>}
      {erreur && <span className="count" style={{ color: '#d14343' }}>{erreur}</span>}
    </div>
  )
}
```

- [ ] **Step 4: Implémenter ResultatsShell**

Create `src/components/resultats-shell.tsx` :

```tsx
'use client'
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { OffreRow } from '@/lib/offres/types'
import OffreListe from './offre-liste'
import { toggleFavori } from '@/lib/favoris/actions'

const CarteOffres = dynamic(() => import('./carte-offres'), { ssr: false })

export default function ResultatsShell(props: {
  recherche: { id: string; intitule: string; localisation: string | null; rayon_km: number | null }
  offres: OffreRow[]
  favoriIds: string[]
}) {
  const [contrat, setContrat] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [likes, setLikes] = useState<Set<string>>(new Set(props.favoriIds))

  const contrats = useMemo(
    () => Array.from(new Set(props.offres.map((o) => o.contrat).filter(Boolean))) as string[],
    [props.offres],
  )
  const visibles = useMemo(
    () => (contrat ? props.offres.filter((o) => o.contrat === contrat) : props.offres),
    [props.offres, contrat],
  )

  const onToggleLike = async (id: string) => {
    setLikes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    try { await toggleFavori(id) } catch { setLikes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* FiltresBar importé ici */}
      <FiltresBarClient poste={props.recherche.intitule} contrats={contrats} contrat={contrat} onContrat={setContrat} rechercheId={props.recherche.id} />
      <div className={`split${collapsed ? ' collapsed' : ''}`} id="split">
        <div className="list-pane" id="list">
          <OffreListe offres={visibles} expandedId={expandedId} hoveredId={hoveredId} likes={likes}
            onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
            onHover={setHoveredId} onToggleLike={onToggleLike} />
        </div>
        <div className="map-pane">
          <button className="map-toggle" aria-label="Replier ou déplier la liste" onClick={() => setCollapsed((c) => !c)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <CarteOffres offres={visibles} hoveredId={hoveredId} expandedId={expandedId}
            onHover={setHoveredId} onSelect={(id) => { setExpandedId(id); setCollapsed(false) }} />
        </div>
      </div>
    </div>
  )
}
```

Ajouter en haut du fichier l'import du composant FiltresBar sous un alias local :

```tsx
import FiltresBarClient from './filtres-bar'
```

- [ ] **Step 5: Page serveur résultats**

Create `src/app/recherche/[id]/page.tsx` :

```tsx
import { notFound, redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getRecherche, getOffresForRecherche } from '@/lib/recherche/offres'
import { getFavoriIds } from '@/lib/favoris/lecture'
import ResultatsShell from '@/components/resultats-shell'

export default async function RechercherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const recherche = await getRecherche(supabase, id)
  if (!recherche) notFound()
  const [offres, favoriIds] = await Promise.all([
    getOffresForRecherche(supabase, id),
    getFavoriIds(supabase, user.id),
  ])
  return <ResultatsShell recherche={recherche} offres={offres} favoriIds={favoriIds} />
}
```

- [ ] **Step 6: Run test + build**

Run: `npm test -- resultats-shell && npm run build`
Expected: PASS + build OK. (Le test mocke `carte-offres` et les actions.)

- [ ] **Step 7: Commit**

```bash
git add src/app/recherche src/components/resultats-shell.tsx src/components/filtres-bar.tsx src/components/resultats-shell.test.tsx
git commit -m "feat(resultats): shell split, filtres, filtre contrat client, repli fluide"
```

---

## Task 8: Liste + carte d'offre (accordéon + like)

**Files:**
- Create: `src/components/offre-liste.tsx`
- Create: `src/components/offre-card.tsx`
- Create: `src/components/like-bouton.tsx`
- Test: `src/components/offre-card.test.tsx`

**Interfaces:**
- Consumes: `OffreRow`, classes `.card`/`.tag`/`.preview`/`.btn-more`/`.like`.
- Produces:
  - `LikeBouton` props : `{ liked: boolean; onToggle: () => void }` (cœur + animation pop via classe `pop` retirée après 560 ms).
  - `OffreCard` props : `{ offre: OffreRow; expanded: boolean; liked: boolean; hovered: boolean; onToggleExpand: () => void; onOpen: () => void; onToggleLike: () => void; onHover: (h: boolean) => void }`.
  - `OffreListe` props : `{ offres: OffreRow[]; expandedId: string | null; hoveredId: string | null; likes: Set<string>; onToggleExpand: (id: string) => void; onHover: (id: string | null) => void; onToggleLike: (id: string) => void }`. Rend un état vide quand `offres` est vide. Chaque carte ouvre la page offre via `window.location` (navigation vers `/offre/[id]`).

- [ ] **Step 1: Écrire le test d'OffreCard**

Create `src/components/offre-card.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OffreCard from './offre-card'
import type { OffreRow } from '@/lib/offres/types'

const offre: OffreRow = {
  id: '1', source: 'ft', source_id: '1', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
  description: 'Belle mission', contrat: 'CDI', salaire: '30 k€', latitude: 47, longitude: -1, ville: '44 - NANTES',
  url_postuler: 'https://x', email_contact: null, date_publication: '2026-01-01',
}

test('affiche titre, employeur, étiquettes ; déroule au clic', async () => {
  const onExpand = vi.fn()
  render(<OffreCard offre={offre} expanded={false} liked={false} hovered={false}
    onToggleExpand={onExpand} onOpen={vi.fn()} onToggleLike={vi.fn()} onHover={vi.fn()} />)
  expect(screen.getByText('Diététicien')).toBeInTheDocument()
  expect(screen.getByText('CDI')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Diététicien'))
  expect(onExpand).toHaveBeenCalled()
})

test('le cœur déclenche onToggleLike sans dérouler', async () => {
  const onExpand = vi.fn(); const onLike = vi.fn()
  render(<OffreCard offre={offre} expanded liked={false} hovered={false}
    onToggleExpand={onExpand} onOpen={vi.fn()} onToggleLike={onLike} onHover={vi.fn()} />)
  await userEvent.click(screen.getByLabelText(/aimer/i))
  expect(onLike).toHaveBeenCalled()
  expect(onExpand).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test, vérifier l'échec**

Run: `npm test -- offre-card`
Expected: FAIL.

- [ ] **Step 3: Implémenter LikeBouton**

Create `src/components/like-bouton.tsx` :

```tsx
'use client'
import { useRef } from 'react'

const HEART = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
  </svg>
)

export default function LikeBouton({ liked, onToggle }: { liked: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <button ref={ref} className={`like${liked ? ' on' : ''}`} aria-label="Aimer cette offre"
      onClick={(e) => {
        e.stopPropagation()
        if (!liked && ref.current) { ref.current.classList.remove('pop'); void ref.current.offsetWidth; ref.current.classList.add('pop'); setTimeout(() => ref.current?.classList.remove('pop'), 560) }
        onToggle()
      }}>
      {HEART}
    </button>
  )
}
```

- [ ] **Step 4: Implémenter OffreCard**

Create `src/components/offre-card.tsx` :

```tsx
'use client'
import LikeBouton from './like-bouton'
import type { OffreRow } from '@/lib/offres/types'

export default function OffreCard(props: {
  offre: OffreRow; expanded: boolean; liked: boolean; hovered: boolean
  onToggleExpand: () => void; onOpen: () => void; onToggleLike: () => void; onHover: (h: boolean) => void
}) {
  const { offre } = props
  return (
    <div className={`card${props.expanded ? ' expanded' : ''}${props.hovered ? ' active' : ''}`}
      onMouseEnter={() => props.onHover(true)} onMouseLeave={() => props.onHover(false)}
      onClick={(e) => { if ((e.target as HTMLElement).closest('.preview')) return; props.onToggleExpand() }}>
      <LikeBouton liked={props.liked} onToggle={props.onToggleLike} />
      <h3>{offre.titre}</h3>
      <div className="emp"><b>{offre.entreprise ?? 'Employeur non précisé'}</b>{offre.ville ? ` · ${offre.ville}` : ''}</div>
      <div className="tags">
        {offre.contrat && <span className="tag">{offre.contrat}</span>}
        {offre.salaire && <span className="tag salary">{offre.salaire}</span>}
        {offre.date_publication && <span className="tag date">{formatDate(offre.date_publication)}</span>}
      </div>
      <div className="preview">
        {offre.description && <p>{offre.description}</p>}
        <button className="btn-more" onClick={(e) => { e.stopPropagation(); props.onOpen() }}>En savoir plus
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
```

- [ ] **Step 5: Implémenter OffreListe (avec état vide)**

Create `src/components/offre-liste.tsx` :

```tsx
'use client'
import OffreCard from './offre-card'
import type { OffreRow } from '@/lib/offres/types'

export default function OffreListe(props: {
  offres: OffreRow[]; expandedId: string | null; hoveredId: string | null; likes: Set<string>
  onToggleExpand: (id: string) => void; onHover: (id: string | null) => void; onToggleLike: (id: string) => void
}) {
  if (props.offres.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>Aucune offre pour cette recherche.</p>
        <p style={{ fontSize: 14 }}>Élargissez le lieu ou le rayon pour trouver plus d'offres.</p>
      </div>
    )
  }
  return (
    <>
      {props.offres.map((o) => (
        <OffreCard key={o.id} offre={o}
          expanded={props.expandedId === o.id} liked={props.likes.has(o.id)} hovered={props.hoveredId === o.id}
          onToggleExpand={() => props.onToggleExpand(o.id)} onOpen={() => { window.location.href = `/offre/${o.id}` }}
          onToggleLike={() => props.onToggleLike(o.id)} onHover={(h) => props.onHover(h ? o.id : null)} />
      ))}
    </>
  )
}
```

- [ ] **Step 6: Run test + build**

Run: `npm test -- offre-card && npm run build`
Expected: PASS + build OK.

- [ ] **Step 7: Commit**

```bash
git add src/components/offre-liste.tsx src/components/offre-card.tsx src/components/like-bouton.tsx src/components/offre-card.test.tsx
git commit -m "feat(offres): liste + carte accordéon avec like et état vide"
```

---

## Task 9: Carte Leaflet (clustering + épingles + mini-preview)

**Files:**
- Create: `src/components/carte-offres.tsx`
- Test: `src/components/carte-offres.test.tsx` (logique de dérivation des points)

**Interfaces:**
- Consumes: `OffreRow`, `positionEpingle` (`@/lib/geo/departements`), `leaflet`, `leaflet.markercluster`.
- Produces: `CarteOffres` (client, `ssr:false`) props : `{ offres: OffreRow[]; hoveredId: string | null; expandedId: string | null; onHover: (id: string | null) => void; onSelect: (id: string) => void }`. Fonction exportée `pointsFor(offres): { id: string; lat: number; lng: number; offre: OffreRow }[]` (pure, testable).

- [ ] **Step 1: Écrire le test de dérivation des points**

Create `src/components/carte-offres.test.tsx` :

```tsx
import { pointsFor } from './carte-offres'
import type { OffreRow } from '@/lib/offres/types'

const base: Omit<OffreRow, 'id' | 'latitude' | 'longitude' | 'ville'> = {
  source: 'ft', source_id: 'x', titre: 't', entreprise: null, entreprise_logo: null, description: null,
  contrat: null, salaire: null, url_postuler: null, email_contact: null, date_publication: null,
}

test('exclut les offres sans position géolocalisable', () => {
  const offres: OffreRow[] = [
    { ...base, id: 'a', latitude: 47, longitude: -1, ville: null },
    { ...base, id: 'b', latitude: null, longitude: null, ville: 'Lieu inconnu' },
    { ...base, id: 'c', latitude: null, longitude: null, ville: '44 - NANTES' },
  ]
  const pts = pointsFor(offres)
  expect(pts.map((p) => p.id).sort()).toEqual(['a', 'c'])
})
```

- [ ] **Step 2: Run test, vérifier l'échec**

Run: `npm test -- carte-offres`
Expected: FAIL.

- [ ] **Step 3: Implémenter CarteOffres**

Create `src/components/carte-offres.tsx`. Composant client vanilla-Leaflet (import dynamique de leaflet dans un `useEffect` pour éviter le SSR). Porter la logique de la maquette (`PIN_SVG`, `initMap`, cluster, popup cliquable, highlight). Extrait :

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { positionEpingle } from '@/lib/geo/departements'
import type { OffreRow } from '@/lib/offres/types'

const PIN_SVG = '<svg width="28" height="38" viewBox="0 0 30 40" fill="currentColor"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 12.4 22.7 14.2 24.5a1.1 1.1 0 0 0 1.6 0C17.6 37.7 30 25.5 30 15 30 6.7 23.3 0 15 0Z" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="15" r="5.4" fill="#fff"/></svg>'

export function pointsFor(offres: OffreRow[]) {
  return offres
    .map((o) => { const p = positionEpingle(o); return p ? { id: o.id, lat: p.lat, lng: p.lng, offre: o } : null })
    .filter(Boolean) as { id: string; lat: number; lng: number; offre: OffreRow }[]
}

export default function CarteOffres(props: {
  offres: OffreRow[]; hoveredId: string | null; expandedId: string | null
  onHover: (id: string | null) => void; onSelect: (id: string) => void
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const clusterRef = useRef<any>(null)
  const selectRef = useRef(props.onSelect); selectRef.current = props.onSelect
  const hoverRef = useRef(props.onHover); hoverRef.current = props.onHover

  // init + (re)build markers quand la liste d'offres change
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const Lmod = await import('leaflet')
      const L = ((Lmod as any).default ?? Lmod) as typeof import('leaflet')
      await import('leaflet.markercluster')
      if (cancelled || !elRef.current) return
      if (!mapRef.current) {
        mapRef.current = L.map(elRef.current, { zoomControl: true }).setView([47.35, -1.2], 6)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OpenStreetMap, © CARTO' }).addTo(mapRef.current)
      }
      if (clusterRef.current) { mapRef.current.removeLayer(clusterRef.current) }
      markersRef.current = {}
      clusterRef.current = (L as any).markerClusterGroup({
        showCoverageOnHover: false, maxClusterRadius: 48,
        iconCreateFunction: (c: any) => L.divIcon({ html: `<div class="cluster-pin">${c.getChildCount()}</div>`, className: '', iconSize: [42, 42] }),
      })
      for (const pt of pointsFor(props.offres)) {
        const icon = L.divIcon({ className: '', html: `<div class="pin">${PIN_SVG}</div>`, iconSize: [28, 38], iconAnchor: [14, 38] })
        const m = L.marker([pt.lat, pt.lng], { icon })
        const o = pt.offre
        const sal = o.salaire ? `<span class="mp-s">${o.salaire}</span>` : '<span></span>'
        m.bindPopup(`<div class="mp-link"><div class="mp-t">${o.titre}</div><div class="mp-e">${o.entreprise ?? ''}${o.ville ? ' · ' + o.ville : ''}</div><div class="mp-foot">${sal}<span class="mp-go">Voir l'offre <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span></div></div>`, { closeButton: false, offset: [0, -30] })
        m.on('popupopen', (e: any) => { e.popup.getElement()?.querySelector('.mp-link')?.addEventListener('click', () => selectRef.current(o.id)) })
        m.on('click', () => { selectRef.current(o.id); if (clusterRef.current.zoomToShowLayer) clusterRef.current.zoomToShowLayer(m, () => m.openPopup()); else m.openPopup() })
        m.on('mouseover', () => hoverRef.current(o.id))
        m.on('mouseout', () => hoverRef.current(null))
        markersRef.current[o.id] = m
        clusterRef.current.addLayer(m)
      }
      mapRef.current.addLayer(clusterRef.current)
      mapRef.current.invalidateSize()
    })()
    return () => { cancelled = true }
  }, [props.offres])

  // survol synchronisé liste -> épingle
  useEffect(() => {
    for (const [id, m] of Object.entries(markersRef.current)) {
      const pin = (m as any)._icon?.querySelector('.pin')
      if (pin) pin.classList.toggle('active', id === props.hoveredId)
    }
  }, [props.hoveredId])

  return <div ref={elRef} id="map" style={{ position: 'absolute', inset: 0 }} />
}
```

Note : importer le CSS Leaflet et markercluster une fois. Ajouter en haut du fichier :
```tsx
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
```

- [ ] **Step 4: Run test + build**

Run: `npm test -- carte-offres && npm run build`
Expected: PASS + build OK. (Le test n'importe que `pointsFor` ; le rendu Leaflet n'est pas monté en jsdom.)

- [ ] **Step 5: Commit**

```bash
git add src/components/carte-offres.tsx src/components/carte-offres.test.tsx
git commit -m "feat(carte): Leaflet, clustering, épingles stylisées, mini-preview cliquable"
```

---

## Task 10: Page offre + espace compte

**Files:**
- Create: `src/app/offre/[id]/page.tsx`
- Create: `src/components/offre-detail.tsx`
- Replace stub: `src/components/compte-menu.tsx`
- Test: `src/components/offre-detail.test.tsx`

**Interfaces:**
- Consumes: `getServerClient`, `OffreRow`, `getFavoriIds`, `toggleFavori`, `OFFRE_COLUMNS`.
- Produces:
  - Page serveur `/offre/[id]` : lit l'offre (table `offres`, lecture mutualisée) + statut like, rend `OffreDetail`.
  - `OffreDetail` (client) props : `{ offre: OffreRow; likedInitial: boolean }` : en-tête avatar (logo sinon initiale), description, encart récap, mini-carte, boutons Sauvegarder / Postuler / placeholder IA.
  - `CompteMenu` (client) : avatar fixe + menu déroulant (Mon profil, Mes offres likées, Paramètres, Déconnexion) ; masqué sur `/login`.

- [ ] **Step 1: Écrire le test d'OffreDetail (avatar + postuler)**

Create `src/components/offre-detail.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import OffreDetail from './offre-detail'
import type { OffreRow } from '@/lib/offres/types'

vi.mock('@/lib/favoris/actions', () => ({ toggleFavori: vi.fn(async () => ({ liked: true })) }))

const offre: OffreRow = {
  id: '1', source: 'ft', source_id: '1', titre: 'Diététicien', entreprise: 'Clinique du Parc', entreprise_logo: null,
  description: 'Mission', contrat: 'CDI', salaire: '30 k€', latitude: 47, longitude: -1, ville: '44 - NANTES',
  url_postuler: 'https://ft/offre', email_contact: null, date_publication: '2026-01-01',
}

test('affiche le titre, l’initiale employeur en repli, et un lien Postuler', () => {
  render(<OffreDetail offre={offre} likedInitial={false} />)
  expect(screen.getByRole('heading', { name: 'Diététicien' })).toBeInTheDocument()
  expect(screen.getByText('C')).toBeInTheDocument() // initiale de "Clinique…"
  expect(screen.getByRole('link', { name: /postuler/i })).toHaveAttribute('href', 'https://ft/offre')
})

test('affiche le logo employeur quand présent', () => {
  render(<OffreDetail offre={{ ...offre, entreprise_logo: 'https://x/logo.png' }} likedInitial={false} />)
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://x/logo.png')
})
```

- [ ] **Step 2: Run test, vérifier l'échec**

Run: `npm test -- offre-detail`
Expected: FAIL.

- [ ] **Step 3: Implémenter OffreDetail**

Create `src/components/offre-detail.tsx`. Client. En-tête (avatar logo/initiale), description, encart récap avec icônes, mini-carte Leaflet (réutiliser un petit composant interne ou une `CarteOffres` mono-point ; pour rester simple, une `<div>` Leaflet dédiée en `useEffect`). Boutons : Sauvegarder (like, `useTransition` + `toggleFavori`), Postuler (`<a href={url_postuler} target="_blank" rel="noopener">`), placeholder IA désactivé. Porter le markup `.detail-*` de la maquette. Le rendu de la mini-carte peut réutiliser le pattern de Task 9 (import dynamique de leaflet dans un effet). L'avatar :

```tsx
const initial = (offre.entreprise?.trim()[0] ?? '?').toUpperCase()
// ...
<div className="d-avatar">
  {offre.entreprise_logo
    ? <img src={offre.entreprise_logo} alt={offre.entreprise ?? ''} onError={(e) => { (e.currentTarget.parentNode as HTMLElement).textContent = initial }} />
    : initial}
</div>
```

Le bouton Postuler n'apparaît que si `offre.url_postuler` existe ; sinon afficher un état désactivé « Lien indisponible ». Inclure le bouton « Sauvegarder l'offre » (classe `.btn-save`, état `on` si liké) et le placeholder « Candidater avec lettre IA · bientôt » (classe `.btn-future`, non cliquable). Un bouton retour « Retour aux résultats » via `history.back()` ou un `<a>` vers la recherche d'origine si connue (sinon `history.back()`).

**Important pour les tests (jsdom)** : l'initialisation Leaflet de la mini-carte doit se faire dans un `useEffect` avec import dynamique (`await import('leaflet')`) et être entourée d'un `try/catch` silencieux, afin que le rendu du composant ne casse pas en environnement de test (jsdom ne fournit pas toutes les API cartographiques). Le test ne monte pas la carte, il vérifie l'en-tête et le lien Postuler.

- [ ] **Step 4: Page serveur offre**

Create `src/app/offre/[id]/page.tsx` :

```tsx
import { notFound, redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import { getFavoriIds } from '@/lib/favoris/lecture'
import OffreDetail from '@/components/offre-detail'

export default async function OffrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: offre } = await supabase.from('offres').select(OFFRE_COLUMNS).eq('id', id).single()
  if (!offre) notFound()
  const favoriIds = await getFavoriIds(supabase, user.id)
  return <OffreDetail offre={offre as OffreRow} likedInitial={favoriIds.includes(id)} />
}
```

- [ ] **Step 5: Implémenter CompteMenu (remplace le stub)**

Replace `src/components/compte-menu.tsx`. Client. Avatar fixe haut droite + menu déroulant. Masqué sur `/login` (via `usePathname`). Porter le markup `.account`/`.acc-menu` de la maquette. Items : « Mon profil » et « Mes offres likées » → `<a href="/profil">` ; « Paramètres du compte » (no-op pour le MVP) ; « Déconnexion » → appelle `getBrowserClient().auth.signOut()` puis `window.location.href = '/login'`. Fermeture au clic extérieur (listener document). Exemple de squelette :

```tsx
'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'

export default function CompteMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('#account')) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  if (pathname === '/login') return null
  const logout = async () => { await getBrowserClient().auth.signOut(); window.location.href = '/login' }
  return (
    <div className="account" id="account">
      <button className="avatar-btn" aria-label="Mon compte" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
        <span className="ava">M</span>
      </button>
      <div className={`acc-menu${open ? ' on' : ''}`}>
        <a href="/profil"><span>Mon profil</span></a>
        <a href="/profil"><span>Mes offres likées</span></a>
        <button type="button">Paramètres du compte</button>
        <div className="acc-sep" />
        <button type="button" className="danger" onClick={logout}>Déconnexion</button>
      </div>
    </div>
  )
}
```

Note : porter les icônes SVG du menu depuis la maquette ; garder les classes `.acc-menu > a`/`> button` cohérentes avec le CSS porté (adapter le sélecteur CSS si on utilise `<a>` au lieu de `<button>`).

- [ ] **Step 6: Run test + build**

Run: `npm test -- offre-detail && npm run build`
Expected: PASS + build OK.

- [ ] **Step 7: Commit**

```bash
git add src/app/offre src/components/offre-detail.tsx src/components/compte-menu.tsx src/components/offre-detail.test.tsx
git commit -m "feat(offre): page offre dédiée + espace compte global"
```

---

## Task 11: Profil enrichi (offres likées)

**Files:**
- Modify: `src/app/profil/page.tsx`
- Create: `src/components/offres-likees.tsx`
- Test: `src/components/offres-likees.test.tsx`

**Interfaces:**
- Consumes: `getServerClient`, `getFavoris` (`@/lib/favoris/lecture`), `OffreRow`.
- Produces: section « Mes offres likées » sur `/profil` : grille de cartes cliquables (vers `/offre/[id]`) + état vide. `OffresLikees` props : `{ offres: OffreRow[] }`.

- [ ] **Step 1: Écrire le test**

Create `src/components/offres-likees.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import OffresLikees from './offres-likees'
import type { OffreRow } from '@/lib/offres/types'

const o = (id: string, titre: string): OffreRow => ({
  id, source: 'ft', source_id: id, titre, entreprise: 'E', entreprise_logo: null, description: null,
  contrat: 'CDI', salaire: null, latitude: null, longitude: null, ville: '44 - NANTES',
  url_postuler: null, email_contact: null, date_publication: '2026-01-01',
})

test('liste les offres likées', () => {
  render(<OffresLikees offres={[o('1', 'Diététicien'), o('2', 'Nutritionniste')]} />)
  expect(screen.getByText('Diététicien')).toBeInTheDocument()
  expect(screen.getByText('Nutritionniste')).toBeInTheDocument()
})

test('affiche un état vide sans offre likée', () => {
  render(<OffresLikees offres={[]} />)
  expect(screen.getByText(/aucune offre likée/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test, vérifier l'échec**

Run: `npm test -- offres-likees`
Expected: FAIL.

- [ ] **Step 3: Implémenter OffresLikees**

Create `src/components/offres-likees.tsx` :

```tsx
import type { OffreRow } from '@/lib/offres/types'

export default function OffresLikees({ offres }: { offres: OffreRow[] }) {
  if (offres.length === 0) {
    return (
      <div className="liked-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
        <div>Aucune offre likée pour l'instant.<br />Cliquez le cœur sur une offre pour la retrouver ici.</div>
      </div>
    )
  }
  return (
    <div className="liked-list">
      {offres.map((o) => (
        <a key={o.id} className="card" href={`/offre/${o.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <h3>{o.titre}</h3>
          <div className="emp"><b>{o.entreprise ?? 'Employeur non précisé'}</b>{o.ville ? ` · ${o.ville}` : ''}</div>
          <div className="tags">
            {o.contrat && <span className="tag">{o.contrat}</span>}
            {o.salaire && <span className="tag salary">{o.salaire}</span>}
          </div>
        </a>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Brancher sur la page profil**

In `src/app/profil/page.tsx`, after loading the profil, also load favoris and render the section. Update the component:

```tsx
import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getProfil, type Profil } from '@/lib/profil'
import { getFavoris } from '@/lib/favoris/lecture'
import ProfilForm from './profil-form'
import OffresLikees from '@/components/offres-likees'

export default async function ProfilPage() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [existing, favoris] = await Promise.all([getProfil(supabase, user.id), getFavoris(supabase, user.id)])
  const initial: Profil = existing ?? { user_id: user.id, nom: null, titre_recherche: null, cv_url: null, lettre_base: null }
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Mon profil</h1>
      <ProfilForm initial={initial} />
      <section className="mt-10">
        <div className="liked-headrow"><h3>Mes offres likées</h3><span className="liked-count">{favoris.length} offre{favoris.length > 1 ? 's' : ''}</span></div>
        <OffresLikees offres={favoris} />
      </section>
    </main>
  )
}
```

- [ ] **Step 5: Run test + build**

Run: `npm test -- offres-likees && npm run build`
Expected: PASS + build OK.

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: toute la suite verte.

- [ ] **Step 7: Commit**

```bash
git add src/app/profil/page.tsx src/components/offres-likees.tsx src/components/offres-likees.test.tsx
git commit -m "feat(profil): section offres likées avec état vide"
```

---

## Validation E2E finale (manuelle, après merge)

Après la migration `0002` appliquée sur Supabase distant :
1. `npm run dev`, se connecter avec le compte démo.
2. Accueil : taper « diététicien », vérifier la redirection vers `/recherche/[id]` et l'affichage des offres triées par date.
3. Résultats : dérouler une offre, replier la liste (animation fluide), cliquer une épingle (mini-preview → page offre), tester le filtre contrat.
4. Page offre : avatar (logo ou initiale), Postuler (nouvel onglet), Sauvegarder (like).
5. Menu compte → Mon profil : l'offre likée apparaît ; retirer le like la retire.
6. Affiner par lieu (ex. « Nantes ») : nouvelle collecte, résultats locaux.
