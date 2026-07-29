# JobCompass · Brique 7 : Alertes & nouvelles offres · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une cloche + boîte de réception des nouvelles offres (pastille rouge, expiration 24 h, consultation par offre) alimentée par une re-collecte, et un opt-in « Alertes mail » par recherche envoyant les nouvelles offres via Resend.

**Architecture:** Une table `nouvelles_offres` (boîte par utilisateur) est remplie par un endpoint `/api/refresh` qui re-collecte une recherche, compare les `resultats` avant/après et enregistre les nouveautés pour le propriétaire (+ email si opt-in). La cloche lit la boîte sous RLS ; consulter une offre pose `vue_le`. Le toggle bascule `recherches.alertes_email`. Fonctions pures/injectables et testées ; l'envoi email est best-effort (ignoré sans clé).

**Tech Stack:** Next.js 16 (App Router, Server Actions, Route Handlers, `params` = Promise), React 19, Supabase (`@supabase/ssr` + `@supabase/supabase-js`, service role pour le refresh), Resend REST via `fetch`, Vitest + @testing-library/react.

## Global Constraints

- **Spec de référence :** `docs/superpowers/specs/2026-07-29-jobcompass-mvp-7-alertes-design.md`. En cas de doute, la spec prime.
- **Aucune nouvelle dépendance npm.** Resend appelé en `fetch` REST (comme France Travail / Gemini).
- **Nouvelle offre** = offre nouvellement liée (`resultats`) à une recherche lors d'une re-collecte (différence avant/après). Dédoublonnée par `(user_id, offre_id)`.
- **Expiration 24 h** : filtrage à la lecture par `created_at > now() - 24h`. Pastille = non vues (`vue_le is null`) et non expirées.
- **Secrets serveur uniquement** : `RESEND_API_KEY`, `ALERTE_FROM`, `COLLECT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` jamais exposés au navigateur. L'email est **best-effort** : sans `RESEND_API_KEY`, on n'envoie rien et on renvoie `false` (aucune erreur bloquante).
- **`/api/refresh` protégé** par `Authorization: Bearer ${COLLECT_SECRET}` (comme `/api/collect`), via le **service client** (bypass RLS).
- **Tout module Vitest DOIT importer explicitement ses helpers** : `import { expect, test, vi } from 'vitest'` (ou sous-ensemble). tsconfig inclut `**/*.ts`.
- **TS gotcha** : un mock `vi.fn(() => ...)` (zéro arg) déstructuré via `.mock.calls[0]` casse (TS2493) ; élargir en `vi.fn((..._args: unknown[]) => ...)`.
- **Server Actions (`'use server'`)** : n'exportent QUE des fonctions `async` ; logique testable (client injecté) dans des modules SANS `'use server'`. `revalidatePath` hors try/catch.
- **Français** dans toute copie visible. **Jamais de tiret cadratin `—`** : utiliser `:`, `,` ou `·`.
- **Injection de dépendances** : accès Supabase / `fetch` / collecte via paramètre injecté.
- **RLS** : `nouvelles_offres_self` couvre la boîte de l'utilisateur ; le refresh écrit via le service client.
- **Migrations** : `supabase/migrations/000N_*.sql` numérotés à la suite (dernier = `0008`). Appliquées manuellement sur Supabase distant après merge.

---

## File Structure

**Créés :**
- `supabase/migrations/0009_alertes.sql`
- `src/lib/alertes/boite.ts` : `NouvelleOffre`, `getBoite`, `compterNonVues`, `marquerOffreVue`.
- `src/lib/alertes/detection.ts` : `offreIdsLies`, `rafraichirRecherche`, `enregistrerNouvelles`.
- `src/lib/alertes/email.ts` : `buildEmailHtml`, `envoyerAlerte`.
- `src/lib/alertes/actions.ts` (`'use server'`) : `basculerAlertesEmail`, `marquerVue`.
- `src/app/api/refresh/route.ts` : endpoint de rafraîchissement.
- `src/components/cloche-notifs.tsx` : cloche + boîte (client).
- `src/components/alerte-mail-toggle.tsx` : toggle opt-in (client).
- `vercel.json` : cron.
- Tests colocalisés.

**Modifiés :**
- `src/app/layout.tsx` : monte `ClocheNotifs` à côté de `CompteMenu`.
- `src/components/offre-detail.tsx` : marque l'offre vue au chargement.
- `src/lib/recherche/offres.ts` : `getRecherche` lit `alertes_email`.
- `src/components/resultats-shell.tsx` + `src/components/filtres-bar.tsx` : passent/affichent le toggle.
- `src/app/globals.css` : styles cloche + toggle.

---

### Task 1: Migration 0009 + boîte de réception

**Files:**
- Create: `supabase/migrations/0009_alertes.sql`
- Create: `src/lib/alertes/boite.ts`
- Test: `src/lib/alertes/boite.test.ts`

**Interfaces:**
- Consumes: `OFFRE_COLUMNS`, `OffreRow` de `@/lib/offres/types` ; `SupabaseClient`.
- Produces:
  - `type NouvelleOffre = { offre: OffreRow; created_at: string; vue_le: string | null }`
  - `getBoite(client, userId): Promise<NouvelleOffre[]>` (< 24 h, triées récentes d'abord)
  - `compterNonVues(client, userId): Promise<number>` (vue_le null, < 24 h)
  - `marquerOffreVue(client, userId, offreId): Promise<void>`

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/0009_alertes.sql` :

```sql
-- Opt-in email par recherche + horodatage de collecte.
alter table public.recherches add column if not exists alertes_email boolean not null default false;
alter table public.recherches add column if not exists derniere_collecte timestamptz;

-- Boîte de réception des nouvelles offres, par utilisateur.
create table if not exists public.nouvelles_offres (
  user_id uuid not null references auth.users(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  recherche_id uuid references public.recherches(id) on delete set null,
  created_at timestamptz not null default now(),
  vue_le timestamptz,
  primary key (user_id, offre_id)
);
alter table public.nouvelles_offres enable row level security;
create policy nouvelles_offres_self on public.nouvelles_offres
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Écrire les tests qui échouent**

Créer `src/lib/alertes/boite.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { getBoite, compterNonVues, marquerOffreVue } from './boite'

test('getBoite ne renvoie que les entrées non expirées, jointes aux offres, triées', async () => {
  const rows = [
    { created_at: '2026-07-29T10:00:00Z', vue_le: null, offres: { id: 'o2', titre: 'B' } },
    { created_at: '2026-07-29T08:00:00Z', vue_le: '2026-07-29T09:00:00Z', offres: { id: 'o1', titre: 'A' } },
  ]
  const gt = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eq = vi.fn(() => ({ gt }))
  const select = vi.fn(() => ({ eq }))
  const client = { from: vi.fn(() => ({ select })) } as any

  const out = await getBoite(client, 'u1')

  expect(client.from).toHaveBeenCalledWith('nouvelles_offres')
  expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  // filtre d'expiration appliqué sur created_at
  expect(gt).toHaveBeenCalledWith('created_at', expect.any(String))
  expect(out.map((n) => n.offre.id)).toEqual(['o2', 'o1'])
})

test('compterNonVues filtre vue_le null et non expirées', async () => {
  const gt = vi.fn().mockResolvedValue({ data: [{ offre_id: 'a' }, { offre_id: 'b' }], error: null })
  const is = vi.fn(() => ({ gt }))
  const eq = vi.fn(() => ({ is }))
  const select = vi.fn(() => ({ eq }))
  const client = { from: vi.fn(() => ({ select })) } as any

  const n = await compterNonVues(client, 'u1')
  expect(is).toHaveBeenCalledWith('vue_le', null)
  expect(n).toBe(2)
})

test('marquerOffreVue pose vue_le pour l\'entrée non vue', async () => {
  const calls: any[] = []
  const is = vi.fn(() => Promise.resolve({ error: null }))
  const eq2 = vi.fn(() => ({ is }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  const update = vi.fn((p: any) => { calls.push(p); return { eq: eq1 } })
  const client = { from: vi.fn(() => ({ update })) } as any

  await marquerOffreVue(client, 'u1', 'o1')
  expect(client.from).toHaveBeenCalledWith('nouvelles_offres')
  expect(calls[0]).toHaveProperty('vue_le')
})
```

- [ ] **Step 3: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/alertes/boite.test.ts
```
Attendu : FAIL (module absent).

- [ ] **Step 4: Implémenter**

Créer `src/lib/alertes/boite.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'

export type NouvelleOffre = { offre: OffreRow; created_at: string; vue_le: string | null }

function cutoff24h(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export async function getBoite(client: SupabaseClient, userId: string): Promise<NouvelleOffre[]> {
  const { data, error } = await client
    .from('nouvelles_offres')
    .select(`created_at, vue_le, offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('user_id', userId)
    .gt('created_at', cutoff24h())
  if (error) throw error
  if (!data) return []
  const items = data
    .map((r: any) => {
      const offre = (Array.isArray(r.offres) ? r.offres[0] : r.offres) as OffreRow | null
      if (!offre) return null
      return { offre, created_at: r.created_at, vue_le: r.vue_le ?? null }
    })
    .filter(Boolean) as NouvelleOffre[]
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function compterNonVues(client: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await client
    .from('nouvelles_offres')
    .select('offre_id')
    .eq('user_id', userId)
    .is('vue_le', null)
    .gt('created_at', cutoff24h())
  if (error) throw error
  return (data ?? []).length
}

export async function marquerOffreVue(client: SupabaseClient, userId: string, offreId: string): Promise<void> {
  const { error } = await client
    .from('nouvelles_offres')
    .update({ vue_le: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('offre_id', offreId)
    .is('vue_le', null)
  if (error) throw error
}
```

- [ ] **Step 5: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/alertes/boite.test.ts
```
Attendu : PASS.

- [ ] **Step 6: Vérifier types**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit
```
Attendu : tsc propre.

- [ ] **Step 7: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(alertes): migration 0009 + boîte de réception (getBoite, compterNonVues, marquerOffreVue)"
```

---

### Task 2: Détection des nouvelles offres

**Files:**
- Create: `src/lib/alertes/detection.ts`
- Test: `src/lib/alertes/detection.test.ts`

**Interfaces:**
- Consumes: `collectForRecherche` de `@/lib/collector/collect` (`(client, recherche & {id}) => Promise<{collected, linked}>`) ; `SupabaseClient`.
- Produces:
  - `offreIdsLies(client, rechercheId): Promise<Set<string>>`
  - `rafraichirRecherche(client, recherche, deps?: { collect?: typeof collectForRecherche }): Promise<{ nouvelles: string[] }>`
  - `enregistrerNouvelles(client, userId, rechercheId, offreIds): Promise<number>`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/alertes/detection.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { rafraichirRecherche, enregistrerNouvelles } from './detection'

function clientLies(avant: string[], apres: string[]) {
  let appel = 0
  const eq = vi.fn(() => {
    appel += 1
    const ids = appel === 1 ? avant : apres
    return Promise.resolve({ data: ids.map((offre_id) => ({ offre_id })), error: null })
  })
  const select = vi.fn(() => ({ eq }))
  const update = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
  const client = { from: vi.fn(() => ({ select, update })) } as any
  return client
}

test('rafraichirRecherche renvoie les offre_id apparus entre avant et après', async () => {
  const client = clientLies(['a', 'b'], ['a', 'b', 'c', 'd'])
  const collect = vi.fn().mockResolvedValue({ collected: 4, linked: 4 })
  const recherche = { id: 'r1', mots_cles: ['x'], localisation: null, rayon_km: null, type_contrat: null }

  const { nouvelles } = await rafraichirRecherche(client, recherche as any, { collect })

  expect(collect).toHaveBeenCalledTimes(1)
  expect(nouvelles.sort()).toEqual(['c', 'd'])
})

test('enregistrerNouvelles upsert ignoreDuplicates et renvoie le nombre inséré', async () => {
  const select = vi.fn().mockResolvedValue({ data: [{ offre_id: 'c' }], error: null })
  const upsert = vi.fn(() => ({ select }))
  const client = { from: vi.fn(() => ({ upsert })) } as any

  const n = await enregistrerNouvelles(client, 'u1', 'r1', ['c', 'd'])

  expect(client.from).toHaveBeenCalledWith('nouvelles_offres')
  const [rows, opts] = upsert.mock.calls[0]
  expect(rows).toEqual([
    expect.objectContaining({ user_id: 'u1', offre_id: 'c', recherche_id: 'r1' }),
    expect.objectContaining({ user_id: 'u1', offre_id: 'd', recherche_id: 'r1' }),
  ])
  expect(opts).toMatchObject({ onConflict: 'user_id,offre_id', ignoreDuplicates: true })
  expect(n).toBe(1)
})

test('enregistrerNouvelles ne fait rien si la liste est vide', async () => {
  const client = { from: vi.fn() } as any
  const n = await enregistrerNouvelles(client, 'u1', 'r1', [])
  expect(n).toBe(0)
  expect(client.from).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/alertes/detection.test.ts
```
Attendu : FAIL (module absent).

- [ ] **Step 3: Implémenter**

Créer `src/lib/alertes/detection.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { collectForRecherche } from '@/lib/collector/collect'
import type { RechercheRow } from '@/lib/collector/types'

export async function offreIdsLies(client: SupabaseClient, rechercheId: string): Promise<Set<string>> {
  const { data, error } = await client.from('resultats').select('offre_id').eq('recherche_id', rechercheId)
  if (error) throw error
  return new Set((data ?? []).map((r: { offre_id: string }) => r.offre_id))
}

export async function rafraichirRecherche(
  client: SupabaseClient,
  recherche: RechercheRow & { id: string },
  deps: { collect?: typeof collectForRecherche } = {},
): Promise<{ nouvelles: string[] }> {
  const collect = deps.collect ?? collectForRecherche
  const avant = await offreIdsLies(client, recherche.id)
  await collect(client, recherche)
  const apres = await offreIdsLies(client, recherche.id)
  const nouvelles = [...apres].filter((id) => !avant.has(id))
  await client.from('recherches').update({ derniere_collecte: new Date().toISOString() }).eq('id', recherche.id)
  return { nouvelles }
}

export async function enregistrerNouvelles(
  client: SupabaseClient,
  userId: string,
  rechercheId: string,
  offreIds: string[],
): Promise<number> {
  if (offreIds.length === 0) return 0
  const rows = offreIds.map((offre_id) => ({ user_id: userId, offre_id, recherche_id: rechercheId }))
  const { data, error } = await client
    .from('nouvelles_offres')
    .upsert(rows, { onConflict: 'user_id,offre_id', ignoreDuplicates: true })
    .select('offre_id')
  if (error) throw error
  return (data ?? []).length
}
```

- [ ] **Step 4: Lancer, vérifier le succès + tsc**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/alertes/detection.test.ts && npx tsc --noEmit
```
Attendu : PASS, tsc propre.

- [ ] **Step 5: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(alertes): détection des nouvelles offres (rafraichirRecherche + enregistrerNouvelles)"
```

---

### Task 3: Endpoint /api/refresh

**Files:**
- Create: `src/lib/alertes/refresh.ts` (orchestration testable)
- Create: `src/app/api/refresh/route.ts`
- Test: `src/lib/alertes/refresh.test.ts`

**Interfaces:**
- Consumes: `rafraichirRecherche`, `enregistrerNouvelles` de `./detection` ; `requireEnv` de `@/lib/env` ; `getServiceClient` de `@/lib/supabase/service`.
- Produces:
  - `type RechercheAref = { id: string; user_id: string; mots_cles: string[]; localisation: string | null; rayon_km: number | null; type_contrat: string | null; alertes_email: boolean }`
  - `rafraichirEtEnregistrer(client, recherche, deps?): Promise<{ nouvelles: number; email: boolean }>` (détecte, enregistre pour `recherche.user_id`, et si `alertes_email` appelle le hook email injecté)
  - Route `POST /api/refresh` (body `{ recherche_id }` ou `{ all: true }`) et `GET /api/refresh?all=1`, protégées par `Authorization: Bearer ${COLLECT_SECRET}`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/alertes/refresh.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { rafraichirEtEnregistrer } from './refresh'

test('rafraichirEtEnregistrer détecte, enregistre et déclenche l\'email si opt-in', async () => {
  const client = {} as any
  const rafraichir = vi.fn().mockResolvedValue({ nouvelles: ['c', 'd'] })
  const enregistrer = vi.fn().mockResolvedValue(2)
  const envoyer = vi.fn().mockResolvedValue(true)
  const recherche = { id: 'r1', user_id: 'u1', mots_cles: ['x'], localisation: null, rayon_km: null, type_contrat: null, alertes_email: true }

  const out = await rafraichirEtEnregistrer(client, recherche as any, { rafraichir, enregistrer, envoyer })

  expect(rafraichir).toHaveBeenCalledTimes(1)
  expect(enregistrer).toHaveBeenCalledWith(client, 'u1', 'r1', ['c', 'd'])
  expect(envoyer).toHaveBeenCalledTimes(1)
  expect(out).toMatchObject({ nouvelles: 2, email: true })
})

test('pas d\'email si alertes_email est faux', async () => {
  const client = {} as any
  const rafraichir = vi.fn().mockResolvedValue({ nouvelles: ['c'] })
  const enregistrer = vi.fn().mockResolvedValue(1)
  const envoyer = vi.fn()
  const recherche = { id: 'r1', user_id: 'u1', mots_cles: [], localisation: null, rayon_km: null, type_contrat: null, alertes_email: false }

  const out = await rafraichirEtEnregistrer(client, recherche as any, { rafraichir, enregistrer, envoyer })
  expect(envoyer).not.toHaveBeenCalled()
  expect(out).toMatchObject({ nouvelles: 1, email: false })
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/alertes/refresh.test.ts
```
Attendu : FAIL (module absent).

- [ ] **Step 3: Implémenter l'orchestration**

Créer `src/lib/alertes/refresh.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { rafraichirRecherche, enregistrerNouvelles } from './detection'
import { envoyerAlerte } from './email'

export type RechercheAref = {
  id: string
  user_id: string
  intitule: string
  mots_cles: string[]
  localisation: string | null
  rayon_km: number | null
  type_contrat: string | null
  alertes_email: boolean
}

type Deps = {
  rafraichir?: typeof rafraichirRecherche
  enregistrer?: typeof enregistrerNouvelles
  envoyer?: typeof envoyerAlerte
}

export async function rafraichirEtEnregistrer(
  client: SupabaseClient,
  recherche: RechercheAref,
  deps: Deps = {},
): Promise<{ nouvelles: number; email: boolean }> {
  const rafraichir = deps.rafraichir ?? rafraichirRecherche
  const enregistrer = deps.enregistrer ?? enregistrerNouvelles
  const envoyer = deps.envoyer ?? envoyerAlerte

  const { nouvelles } = await rafraichir(client, recherche)
  const nb = await enregistrer(client, recherche.user_id, recherche.id, nouvelles)

  let email = false
  if (recherche.alertes_email && nb > 0) {
    // Récupère l'email du propriétaire (service client) et envoie (best-effort).
    const { data } = await client.auth.admin.getUserById(recherche.user_id)
    const to = data?.user?.email ?? null
    if (to) email = await envoyer({ to, recherche, offreIds: nouvelles }, client)
  }
  return { nouvelles: nb, email }
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/alertes/refresh.test.ts
```
Attendu : PASS. (Le paramètre `envoyer` est injecté dans le test ; l'implémentation réelle d'`envoyerAlerte` arrive en Task 4. Créer un stub temporaire `src/lib/alertes/email.ts` exportant `export async function envoyerAlerte(_p: any, _c?: any): Promise<boolean> { return false }` pour que l'import compile ; il sera remplacé en Task 4.)

- [ ] **Step 5: Écrire la route**

Créer `src/app/api/refresh/route.ts` :

```ts
import { NextResponse } from 'next/server'
import { requireEnv } from '@/lib/env'
import { getServiceClient } from '@/lib/supabase/service'
import { rafraichirEtEnregistrer, type RechercheAref } from '@/lib/alertes/refresh'

const COLS = 'id, user_id, intitule, mots_cles, localisation, rayon_km, type_contrat, alertes_email'

function autorise(request: Request): boolean {
  return request.headers.get('authorization') === `Bearer ${requireEnv('COLLECT_SECRET')}`
}

async function traiter(recherches: RechercheAref[]) {
  const client = getServiceClient()
  let nouvelles = 0
  let emails = 0
  for (const r of recherches) {
    const res = await rafraichirEtEnregistrer(client, r)
    nouvelles += res.nouvelles
    if (res.email) emails += 1
  }
  return { recherches: recherches.length, nouvelles, emails }
}

async function recherchesCibles(rechercheId?: string): Promise<RechercheAref[]> {
  const client = getServiceClient()
  const q = client.from('recherches').select(COLS)
  const { data, error } = rechercheId ? await q.eq('id', rechercheId) : await q
  if (error) throw error
  return (data ?? []) as RechercheAref[]
}

export async function POST(request: Request) {
  if (!autorise(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  let body: { recherche_id?: string; all?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 }) }
  if (!body.recherche_id && !body.all) return NextResponse.json({ error: 'recherche_id ou all requis' }, { status: 400 })
  const cibles = await recherchesCibles(body.all ? undefined : body.recherche_id)
  return NextResponse.json(await traiter(cibles))
}

export async function GET(request: Request) {
  if (!autorise(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const cibles = await recherchesCibles()
  return NextResponse.json(await traiter(cibles))
}
```

- [ ] **Step 6: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 7: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(alertes): endpoint /api/refresh + orchestration rafraichirEtEnregistrer"
```

**Commande locale de test** (à donner à l'utilisateur, une fois les migrations appliquées) :
```bash
curl -X POST http://localhost:3000/api/refresh -H "Authorization: Bearer $COLLECT_SECRET" -H "Content-Type: application/json" -d '{"all":true}'
```

---

### Task 4: Email Resend

**Files:**
- Modify: `src/lib/alertes/email.ts` (remplace le stub)
- Test: `src/lib/alertes/email.test.ts`

**Interfaces:**
- Consumes: offres via `offreIds` + une lecture d'offres, ou directement les offres. Pour rester simple et testable, `envoyerAlerte` reçoit `offreIds` et un `client` pour charger les titres.
- Produces:
  - `buildEmailHtml(intitule: string, offres: { id: string; titre: string; entreprise: string | null; ville: string | null }[], baseUrl: string): string` (pur)
  - `envoyerAlerte(params: { to: string; recherche: { id: string; intitule?: string }; offreIds: string[] }, client: SupabaseClient, deps?: { fetchImpl?: typeof fetch }): Promise<boolean>` (best-effort : sans `RESEND_API_KEY` renvoie `false` sans appel)

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/alertes/email.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { buildEmailHtml, envoyerAlerte } from './email'

test('buildEmailHtml contient l\'intitulé et les offres', () => {
  const html = buildEmailHtml('Diététicien', [
    { id: 'o1', titre: 'Diététicien H/F', entreprise: 'Clinique', ville: 'Nantes' },
  ], 'https://app.test')
  expect(html).toContain('Diététicien H/F')
  expect(html).toContain('Clinique')
  expect(html).toContain('https://app.test/offre/o1')
})

test('envoyerAlerte sans RESEND_API_KEY renvoie false sans appeler fetch', async () => {
  delete process.env.RESEND_API_KEY
  const fetchImpl = vi.fn()
  const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }) } as any
  const ok = await envoyerAlerte({ to: 'a@b.c', recherche: { id: 'r1', intitule: 'Diét' }, offreIds: ['o1'] }, client, { fetchImpl: fetchImpl as any })
  expect(ok).toBe(false)
  expect(fetchImpl).not.toHaveBeenCalled()
})

test('envoyerAlerte poste sur Resend quand la clé est présente', async () => {
  process.env.RESEND_API_KEY = 'test-key'
  const offres = [{ id: 'o1', titre: 'Diét', entreprise: 'C', ville: 'Nantes' }]
  const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: offres, error: null }) }) }) } as any
  const fetchImpl = vi.fn().mockResolvedValue({ ok: true })
  const ok = await envoyerAlerte({ to: 'a@b.c', recherche: { id: 'r1', intitule: 'Diét' }, offreIds: ['o1'] }, client, { fetchImpl: fetchImpl as any })
  expect(ok).toBe(true)
  const [url, init] = fetchImpl.mock.calls[0]
  expect(String(url)).toContain('api.resend.com')
  expect(init.headers.Authorization).toBe('Bearer test-key')
  const body = JSON.parse(init.body)
  expect(body.to).toBe('a@b.c')
  delete process.env.RESEND_API_KEY
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/alertes/email.test.ts
```
Attendu : FAIL (stub actuel ne charge pas les offres / ne poste pas).

- [ ] **Step 3: Implémenter (remplace le stub)**

Remplacer `src/lib/alertes/email.ts` par :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

const RESEND_URL = 'https://api.resend.com/emails'

export function buildEmailHtml(
  intitule: string,
  offres: { id: string; titre: string; entreprise: string | null; ville: string | null }[],
  baseUrl: string,
): string {
  const items = offres
    .map((o) => {
      const lieu = [o.entreprise, o.ville].filter(Boolean).join(' · ')
      return `<li style="margin:0 0 10px"><a href="${baseUrl}/offre/${o.id}" style="color:#248049;font-weight:600;text-decoration:none">${o.titre}</a>${lieu ? `<br><span style="color:#6b7280;font-size:13px">${lieu}</span>` : ''}</li>`
    })
    .join('')
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
<h2 style="color:#1c1e21">Nouvelles offres : ${intitule}</h2>
<p style="color:#6b7280">Voici les nouvelles offres trouvées pour ta recherche :</p>
<ul style="list-style:none;padding:0">${items}</ul>
<p style="color:#9aa0a6;font-size:12px">JobCompass</p></div>`
}

export async function envoyerAlerte(
  params: { to: string; recherche: { id: string; intitule?: string }; offreIds: string[] },
  client: SupabaseClient,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  const fetchImpl = deps.fetchImpl ?? fetch

  const { data } = await client
    .from('offres')
    .select('id, titre, entreprise, ville')
    .in('id', params.offreIds)
  const offres = (data ?? []) as { id: string; titre: string; entreprise: string | null; ville: string | null }[]
  if (offres.length === 0) return false

  const baseUrl = process.env.ALERTE_BASE_URL ?? 'https://jobcompass.app'
  const from = process.env.ALERTE_FROM ?? 'JobCompass <onboarding@resend.dev>'
  const res = await fetchImpl(RESEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: `Nouvelles offres : ${params.recherche.intitule ?? 'ta recherche'}`,
      html: buildEmailHtml(params.recherche.intitule ?? 'ta recherche', offres, baseUrl),
    }),
  })
  return res.ok
}
```

- [ ] **Step 4: Lancer les tests + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/alertes/email.test.ts && npx tsc --noEmit && npx vitest run
```
Attendu : PASS, tsc propre, suite verte.

- [ ] **Step 5: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(alertes): envoi email Resend best-effort (buildEmailHtml + envoyerAlerte)"
```

---

### Task 5: Cloche + boîte de réception (UI)

**Files:**
- Create: `src/components/cloche-notifs.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/offre-detail.tsx`
- Modify: `src/lib/alertes/actions.ts` (créé ici : `marquerVue`)
- Modify: `src/app/globals.css`
- Test: `src/components/cloche-notifs.test.tsx`

**Interfaces:**
- Consumes: `getBoite`, `compterNonVues`, `marquerOffreVue`, `NouvelleOffre` de `@/lib/alertes/boite` ; `getBrowserClient` de `@/lib/supabase/client` ; `getServerClient` de `@/lib/supabase/server`.
- Produces: `ClocheNotifs()` (client) ; Server Action `marquerVue(offreId): Promise<void>`.

- [ ] **Step 1: Créer l'action `marquerVue`**

Créer `src/lib/alertes/actions.ts` :

```ts
'use server'

import { getServerClient } from '@/lib/supabase/server'
import { marquerOffreVue } from './boite'

export async function marquerVue(offreId: string): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await marquerOffreVue(supabase, user.id, offreId)
}
```

- [ ] **Step 2: Écrire le test de la cloche (échoue)**

Créer `src/components/cloche-notifs.test.tsx` :

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import ClocheNotifs from './cloche-notifs'

const boite = [
  { offre: { id: 'o1', titre: 'Diététicien', entreprise: 'Clinique', ville: 'Nantes' }, created_at: '2026-07-29T10:00:00Z', vue_le: null },
]
vi.mock('@/lib/alertes/boite', () => ({
  getBoite: vi.fn().mockResolvedValue(boite),
  compterNonVues: vi.fn().mockResolvedValue(1),
  marquerOffreVue: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))
vi.mock('@/lib/alertes/actions', () => ({ marquerVue: vi.fn() }))

test('affiche la pastille avec le nombre de non vues', async () => {
  render(<ClocheNotifs />)
  expect(await screen.findByText('1')).toBeInTheDocument()
})

test('le panneau liste les nouvelles offres', async () => {
  render(<ClocheNotifs />)
  await waitFor(() => expect(screen.getByText('Diététicien')).toBeInTheDocument())
})
```

- [ ] **Step 3: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/cloche-notifs.test.tsx
```
Attendu : FAIL (composant absent).

- [ ] **Step 4: Implémenter `ClocheNotifs`**

Créer `src/components/cloche-notifs.tsx` :

```tsx
'use client'
import { useEffect, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import { getBoite, compterNonVues, type NouvelleOffre } from '@/lib/alertes/boite'
import { marquerVue } from '@/lib/alertes/actions'

export default function ClocheNotifs() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NouvelleOffre[]>([])
  const [nonVues, setNonVues] = useState(0)

  useEffect(() => {
    let annule = false
    const client = getBrowserClient()
    ;(async () => {
      try {
        const { data: { user } } = await client.auth.getUser()
        if (!user || annule) return
        const [b, n] = await Promise.all([getBoite(client, user.id), compterNonVues(client, user.id)])
        if (!annule) { setItems(b); setNonVues(n) }
      } catch { /* silencieux */ }
    })()
    return () => { annule = true }
  }, [])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('#cloche')) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  async function consulter(offreId: string) {
    setItems((prev) => prev.map((n) => (n.offre.id === offreId ? { ...n, vue_le: 'vu' } : n)))
    setNonVues((v) => Math.max(0, v - 1))
    try { await marquerVue(offreId) } catch { /* non bloquant */ }
    window.location.href = `/offre/${offreId}`
  }

  return (
    <div className="cloche" id="cloche">
      <button className="cloche-btn" aria-label="Nouvelles offres" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {nonVues > 0 && <span className="cloche-pastille">{nonVues}</span>}
      </button>
      <div className={`cloche-menu${open ? ' on' : ''}`}>
        <div className="cloche-head">Nouvelles offres</div>
        {items.length === 0
          ? (
            <div className="cloche-vide">
              Aucune nouvelle offre.
              <small>Les nouvelles offres de tes recherches apparaîtront ici.</small>
            </div>
          )
          : items.map((n) => (
            <button key={n.offre.id} type="button" className={`cloche-item${n.vue_le ? '' : ' neuf'}`} onClick={() => consulter(n.offre.id)}>
              <span className="cloche-item-titre">{n.offre.titre}</span>
              <span className="cloche-item-emp">{n.offre.entreprise ?? 'Employeur non précisé'}{n.offre.ville ? ` · ${n.offre.ville}` : ''}</span>
            </button>
          ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/cloche-notifs.test.tsx
```
Attendu : PASS.

- [ ] **Step 6: Monter la cloche dans le layout**

Dans `src/app/layout.tsx`, importer et rendre `ClocheNotifs` juste avant `CompteMenu` :

```tsx
import ClocheNotifs from '@/components/cloche-notifs'
```

```tsx
      <body>
        <ClocheNotifs />
        <CompteMenu />
        {children}
      </body>
```

- [ ] **Step 7: Marquer l'offre vue à l'ouverture de sa page**

Dans `src/components/offre-detail.tsx`, importer l'action et ajouter un effet au montage :

```tsx
import { marquerVue } from '@/lib/alertes/actions'
```

Ajouter, après les autres `useEffect` :

```tsx
  useEffect(() => {
    marquerVue(offre.id).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offre.id])
```

- [ ] **Step 8: Ajouter les styles cloche**

Dans `src/app/globals.css`, ajouter :

```css
/* Cloche de notifications (à gauche du compte) */
.cloche { position: fixed; top: 18px; right: 68px; z-index: 620; }
.cloche-btn { position: relative; width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--line); background: #fff; color: var(--ink); cursor: pointer; display: grid; place-items: center; }
.cloche-btn:hover { background: #fafafa; }
.cloche-btn svg { width: 19px; height: 19px; }
.cloche-pastille { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 999px; background: #e2565b; color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; }
.cloche-menu { position: absolute; top: 50px; right: 0; width: 320px; max-height: 60vh; overflow-y: auto; background: var(--card); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow-lg); opacity: 0; transform: translateY(-6px); pointer-events: none; transition: .18s; }
.cloche-menu.on { opacity: 1; transform: translateY(0); pointer-events: auto; }
.cloche-head { padding: 14px 16px; font-weight: 700; border-bottom: 1px solid var(--line); }
.cloche-vide { padding: 22px 16px; color: var(--muted); font-size: .9rem; display: flex; flex-direction: column; gap: 6px; }
.cloche-vide small { color: #9aa0a6; font-size: .78rem; }
.cloche-item { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; padding: 12px 16px; border: 0; border-bottom: 1px solid var(--line); background: transparent; cursor: pointer; }
.cloche-item:hover { background: var(--accent-soft); }
.cloche-item.neuf { background: #f3faf5; }
.cloche-item.neuf .cloche-item-titre::after { content: ' •'; color: var(--accent); }
.cloche-item-titre { font-weight: 600; font-size: .9rem; color: var(--ink); }
.cloche-item-emp { font-size: .8rem; color: var(--muted); }
```

- [ ] **Step 9: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 10: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(alertes): cloche + boîte de réception + marquerVue"
```

---

### Task 6: Toggle « Alertes mail » + cron + déploiement

**Files:**
- Create: `src/components/alerte-mail-toggle.tsx`
- Modify: `src/lib/alertes/actions.ts` (`basculerAlertesEmail`)
- Modify: `src/lib/recherche/offres.ts` (`getRecherche` lit `alertes_email`)
- Modify: `src/components/resultats-shell.tsx`, `src/components/filtres-bar.tsx`
- Modify: `src/app/globals.css`
- Create: `vercel.json`
- Test: `src/components/alerte-mail-toggle.test.tsx`

**Interfaces:**
- Consumes: `getServerClient` ; `getRecherche` (élargi).
- Produces: `AlerteMailToggle({ rechercheId, actifInitial }: { rechercheId: string; actifInitial: boolean })` ; Server Action `basculerAlertesEmail(rechercheId): Promise<{ actif: boolean }>`.

- [ ] **Step 1: Ajouter l'action `basculerAlertesEmail`**

Dans `src/lib/alertes/actions.ts`, ajouter :

```ts
import { revalidatePath } from 'next/cache'
```

```ts
export async function basculerAlertesEmail(rechercheId: string): Promise<{ actif: boolean }> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const { data: cur } = await supabase
    .from('recherches').select('alertes_email').eq('id', rechercheId).eq('user_id', user.id).single()
  const actif = !(cur?.alertes_email ?? false)
  const { error } = await supabase
    .from('recherches').update({ alertes_email: actif }).eq('id', rechercheId).eq('user_id', user.id)
  if (error) throw error
  revalidatePath(`/recherche/${rechercheId}`)
  return { actif }
}
```

- [ ] **Step 2: Écrire le test du toggle (échoue)**

Créer `src/components/alerte-mail-toggle.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import AlerteMailToggle from './alerte-mail-toggle'

const basculerAlertesEmail = vi.fn().mockResolvedValue({ actif: true })
vi.mock('@/lib/alertes/actions', () => ({
  basculerAlertesEmail: (...a: unknown[]) => basculerAlertesEmail(...a),
}))

test('reflète l\'état inactif et bascule au clic', async () => {
  const user = userEvent.setup()
  render(<AlerteMailToggle rechercheId="r1" actifInitial={false} />)
  const btn = screen.getByRole('button', { name: /alertes mail/i })
  expect(btn).toHaveAttribute('aria-pressed', 'false')
  await user.click(btn)
  expect(basculerAlertesEmail).toHaveBeenCalledWith('r1')
})

test('reflète l\'état actif', () => {
  render(<AlerteMailToggle rechercheId="r1" actifInitial={true} />)
  expect(screen.getByRole('button', { name: /alertes mail/i })).toHaveAttribute('aria-pressed', 'true')
})
```

- [ ] **Step 3: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/alerte-mail-toggle.test.tsx
```
Attendu : FAIL (composant absent).

- [ ] **Step 4: Implémenter `AlerteMailToggle`**

Créer `src/components/alerte-mail-toggle.tsx` :

```tsx
'use client'
import { useState, useTransition } from 'react'
import { basculerAlertesEmail } from '@/lib/alertes/actions'

export default function AlerteMailToggle({ rechercheId, actifInitial }: { rechercheId: string; actifInitial: boolean }) {
  const [actif, setActif] = useState(actifInitial)
  const [isPending, startTransition] = useTransition()

  function basculer() {
    const cible = !actif
    setActif(cible)
    startTransition(async () => {
      try { const r = await basculerAlertesEmail(rechercheId); setActif(r.actif) } catch { setActif(!cible) }
    })
  }

  return (
    <button
      type="button"
      className={`alerte-toggle${actif ? ' on' : ''}`}
      aria-pressed={actif}
      onClick={basculer}
      disabled={isPending}
      title="Recevoir les nouvelles offres par email"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      Alertes mail
    </button>
  )
}
```

- [ ] **Step 5: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/alerte-mail-toggle.test.tsx
```
Attendu : PASS.

- [ ] **Step 6: `getRecherche` lit `alertes_email`**

Dans `src/lib/recherche/offres.ts`, ajouter `alertes_email` au `.select(...)` de `getRecherche` et au type de retour :

```ts
    .select('id, intitule, localisation, rayon_km, type_contrat, latitude, longitude, lieu_label, alertes_email')
```

```ts
  return (data as
    | {
        id: string; intitule: string; localisation: string | null; rayon_km: number | null
        type_contrat: string | null; latitude: number | null; longitude: number | null
        lieu_label: string | null; alertes_email: boolean
      }
    | null) ?? null
```

- [ ] **Step 7: Passer le toggle dans la barre résultats**

Dans `src/components/resultats-shell.tsx`, passer `alertesEmail` à `FiltresBarClient` :

```tsx
      <FiltresBarClient poste={props.recherche.intitule} contrats={contrats} contrat={contrat} onContrat={setContrat} rechercheId={props.recherche.id}
        initialLieu={props.recherche.lieu_label ?? ''} initialRayon={props.recherche.rayon_km} alertesEmail={props.recherche.alertes_email ?? false} />
```

(Le type `props.recherche` provient de `getRecherche` : il inclut désormais `alertes_email`. Si `ResultatsShell` type ses props explicitement, ajouter `alertes_email?: boolean` au type de `recherche`.)

Dans `src/components/filtres-bar.tsx` : ajouter `alertesEmail: boolean` aux props, importer le toggle, et le rendre après `<div className="spacer" />` :

```tsx
import AlerteMailToggle from './alerte-mail-toggle'
```

```tsx
      <div className="spacer" />
      <AlerteMailToggle rechercheId={props.rechercheId} actifInitial={props.alertesEmail} />
```

- [ ] **Step 8: Ajouter les styles du toggle**

Dans `src/app/globals.css`, ajouter :

```css
/* Toggle Alertes mail (barre résultats) */
.alerte-toggle { display: inline-flex; align-items: center; gap: 7px; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--muted); background: #f4f5f4; border: 1px solid transparent; border-radius: 999px; padding: 8px 13px; cursor: pointer; transition: .18s; white-space: nowrap; }
.alerte-toggle svg { width: 15px; height: 15px; }
.alerte-toggle:hover { background: #edefed; }
.alerte-toggle.on { color: var(--accent-dark); background: var(--accent-soft); border-color: #cdead8; }
.alerte-toggle:disabled { opacity: .6; cursor: default; }
```

- [ ] **Step 9: Créer `vercel.json` (cron)**

Créer `vercel.json` à la racine :

```json
{
  "crons": [
    { "path": "/api/refresh", "schedule": "0 7 * * *" }
  ]
}
```

Note : le cron Vercel appelle l'endpoint en GET. En production, protéger l'appel via l'en-tête `Authorization: Bearer ${COLLECT_SECRET}` que Vercel Cron transmet quand `COLLECT_SECRET` est configuré comme secret de cron (sinon adapter la vérification). Voir la note de déploiement.

- [ ] **Step 10: Vérifier types + suite complète + build**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run && npx next build
```
Attendu : tsc propre, suite verte, build OK.

- [ ] **Step 11: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(alertes): toggle Alertes mail par recherche + cron Vercel"
```

---

## Notes de fin de plan (hors tâches)

- **Migration à appliquer sur Supabase distant après merge** : `0009_alertes.sql` (colonnes `recherches.alertes_email`/`derniere_collecte` + table `nouvelles_offres` + RLS).
- **Variables d'environnement** (à ajouter dans `.env.local` puis Vercel) : `RESEND_API_KEY` (clé Resend gratuite), `ALERTE_FROM` (ex. `JobCompass <onboarding@resend.dev>` en test, une adresse de domaine vérifié en prod), `ALERTE_BASE_URL` (URL publique de l'app pour les liens des emails). `COLLECT_SECRET` déjà présent.
- **Test local de la cloche** : appliquer la migration, puis déclencher une re-collecte via la commande curl de la Task 3 ; les nouvelles offres apparaissent dans la cloche.
- **Déploiement** : sur Vercel, configurer les variables ci-dessus, activer le cron (`vercel.json`), vérifier le domaine d'envoi Resend pour l'expéditeur `ALERTE_FROM`.
- **Best-effort email** : sans `RESEND_API_KEY`, `/api/refresh` remplit quand même la boîte (cloche fonctionnelle), seul l'envoi email est ignoré.
