# JobCompass · Brique 5 : Suivi des candidatures · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un dashboard `/suivi` où l'utilisateur suit ses candidatures envoyées (statut, date de relance, notes), alimenté par un bouton « J'ai postulé » sur la page candidature.

**Architecture:** On enrichit la table `candidatures` (colonnes `notes`, `relance_le`, `postulee_le`) et on utilise le champ `statut` existant comme cycle de vie. Une couche lecture/écriture testable (client Supabase injecté) alimente des Server Actions minces. La page `/suivi` groupe les candidatures par statut (sections + compteurs) ; chaque carte est éditable en direct. Le bouton « J'ai postulé » de l'éditeur fait entrer une candidature dans le suivi.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `params` = Promise), React 19, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Vitest + @testing-library/react.

## Global Constraints

- **Spec de référence :** `docs/superpowers/specs/2026-07-29-jobcompass-mvp-5-suivi-design.md`. En cas de doute, la spec prime.
- **Aucune nouvelle dépendance npm.**
- **Statuts de suivi** : exactement `postulee`, `relancee`, `entretien`, `acceptee`, `refusee` (dans cet ordre d'affichage). `brouillon` = candidature générée non postulée, **exclue** du suivi.
- **Tout module Vitest DOIT importer explicitement ses helpers** : `import { expect, test, vi } from 'vitest'` (ou le sous-ensemble utilisé). Sans ça, `tsc`/`next build` cassent (tsconfig inclut `**/*.ts`).
- **TS gotcha du projet** : un mock construit en `vi.fn(() => ...)` (zéro argument) puis déstructuré via `.mock.calls[0]` déclenche TS2493 (tuple vide). Élargir en `vi.fn((..._args: unknown[]) => ...)` si le cas se présente.
- **Server Actions (`'use server'`)** : un fichier `'use server'` n'exporte QUE des fonctions `async`. La logique testable (client injecté) vit dans `lecture.ts` SANS `'use server'` ; `actions.ts` (avec `'use server'`) ne fait qu'envelopper avec auth + `revalidatePath`. `revalidatePath` hors try/catch.
- **Français** dans toute copie visible. **Jamais de tiret cadratin `—`** : utiliser `:`, `,` ou `·`.
- **Injection de dépendances** : tout accès Supabase passe par un client injecté (pattern `getFavoris(client, userId)` / `upsertCandidature(client, ...)`).
- **RLS** : la policy `candidatures_self` (`auth.uid() = user_id`) est déjà en place ; le client serveur authentifié (`getServerClient`) la respecte. Pas de service client ici.
- **Migrations** : fichiers `supabase/migrations/000N_*.sql` numérotés à la suite (dernier = `0006`). Appliquées manuellement sur Supabase distant après merge ; le plan ne les exécute pas.

---

## File Structure

**Créés :**
- `supabase/migrations/0007_suivi.sql` : colonnes `notes`, `relance_le`, `postulee_le`.
- `src/lib/suivi/statuts.ts` : `StatutSuivi`, `STATUTS_SUIVI`, `STATUT_LABEL`, `estStatutSuivi`.
- `src/lib/suivi/lecture.ts` : `getSuivi` + helpers d'écriture (`setPostulee`, `clearSuivi`, `setStatut`, `setDetailsSuivi`), client injecté.
- `src/lib/suivi/actions.ts` (`'use server'`) : `marquerPostulee`, `retirerDuSuivi`, `changerStatut`, `enregistrerSuivi`.
- `src/app/suivi/page.tsx` : page serveur du dashboard.
- `src/components/suivi-liste.tsx` : en-tête compteurs + sections par statut + état vide.
- `src/components/suivi-carte.tsx` : carte de candidature éditable (client).
- Tests colocalisés : `lecture.test.ts` (suivi), `actions`-couverts via lecture, `suivi-liste.test.tsx`, `suivi-carte.test.tsx`.

**Modifiés :**
- `src/lib/candidature/lecture.ts` : `upsertCandidature` cesse d'écrire `statut`. `lecture.test.ts` (candidature) ajusté.
- `src/components/candidature-editor.tsx` : bouton « J'ai postulé » + encart suivi, suit le `statut` en état.
- `src/components/compte-menu.tsx` : lien « Suivi des candidatures ».
- `src/app/page.tsx` : lien discret vers `/suivi`.
- `src/app/globals.css` : styles dashboard + pastilles de statut + encart suivi.

---

### Task 1: Migration 0007 + correctif upsertCandidature

**Files:**
- Create: `supabase/migrations/0007_suivi.sql`
- Modify: `src/lib/candidature/lecture.ts`
- Modify: `src/lib/candidature/lecture.test.ts`

**Interfaces:**
- Consumes: `upsertCandidature(client, userId, offreId, contenu)` existant.
- Produces: `upsertCandidature` n'inclut plus `statut` dans son payload d'upsert (le statut existant est préservé à la mise à jour ; défaut `brouillon` à l'insertion).

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/0007_suivi.sql` :

```sql
-- Suivi des candidatures : notes libres, date de relance, date de candidature.
alter table public.candidatures add column if not exists notes text;
alter table public.candidatures add column if not exists relance_le date;
alter table public.candidatures add column if not exists postulee_le date;
```

- [ ] **Step 2: Mettre à jour le test de upsertCandidature**

Dans `src/lib/candidature/lecture.test.ts`, le test `upsertCandidature upsert sur (user_id, offre_id) avec le contenu` doit vérifier que `statut` n'est PLUS envoyé. Remplacer son corps par :

```ts
test('upsertCandidature upsert sur (user_id, offre_id) sans écraser le statut', async () => {
  const row = { user_id: 'u1', offre_id: 'o1', email_objet: 'O', email_corps: 'C', lettre: 'L', statut: 'postulee' }
  const single = vi.fn().mockResolvedValue({ data: row, error: null })
  const select = vi.fn(() => ({ single }))
  const upsert = vi.fn((..._args: unknown[]) => ({ select }))
  const client = { from: vi.fn(() => ({ upsert })) } as any

  const out = await upsertCandidature(client, 'u1', 'o1', { email_objet: 'O', email_corps: 'C', lettre: 'L' })

  const [payload, opts] = upsert.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>]
  expect(payload).toMatchObject({ user_id: 'u1', offre_id: 'o1', email_objet: 'O', email_corps: 'C', lettre: 'L' })
  // statut NON présent : un statut existant (ex. 'postulee') n'est pas remis à 'brouillon'
  expect(payload).not.toHaveProperty('statut')
  expect(opts).toMatchObject({ onConflict: 'user_id,offre_id' })
  expect(out).toMatchObject({ user_id: 'u1', offre_id: 'o1' })
})
```

- [ ] **Step 3: Lancer le test, vérifier qu'il échoue**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/candidature/lecture.test.ts
```
Attendu : FAIL (le payload contient encore `statut`).

- [ ] **Step 4: Retirer `statut` du payload d'upsertCandidature**

Dans `src/lib/candidature/lecture.ts`, supprimer la ligne `statut: 'brouillon',` du payload de `upsertCandidature` :

```ts
    .upsert(
      {
        user_id: userId,
        offre_id: offreId,
        email_objet: contenu.email_objet,
        email_corps: contenu.email_corps,
        lettre: contenu.lettre,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,offre_id' },
    )
```

- [ ] **Step 5: Lancer le test, vérifier qu'il passe**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/candidature/lecture.test.ts
```
Attendu : PASS.

- [ ] **Step 6: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 7: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi): migration 0007 + upsertCandidature préserve le statut"
```

---

### Task 2: Métadonnées statuts + lecture getSuivi

**Files:**
- Create: `src/lib/suivi/statuts.ts`
- Create: `src/lib/suivi/lecture.ts`
- Test: `src/lib/suivi/lecture.test.ts`

**Interfaces:**
- Consumes: `OFFRE_COLUMNS`, `OffreRow` de `@/lib/offres/types` ; `SupabaseClient` de `@supabase/supabase-js`.
- Produces :
  - `type StatutSuivi = 'postulee' | 'relancee' | 'entretien' | 'acceptee' | 'refusee'`
  - `const STATUTS_SUIVI: StatutSuivi[]` (ordre d'affichage)
  - `const STATUT_LABEL: Record<StatutSuivi, string>`
  - `function estStatutSuivi(v: string): v is StatutSuivi`
  - `type CandidatureSuivi = { offre: OffreRow; statut: string; postulee_le: string | null; relance_le: string | null; notes: string | null }`
  - `getSuivi(client, userId): Promise<CandidatureSuivi[]>`
  - helpers d'écriture (implémentés ici, testés en Task 3) : signatures définies en Task 3.

- [ ] **Step 1: Créer les métadonnées de statut**

Créer `src/lib/suivi/statuts.ts` :

```ts
export type StatutSuivi = 'postulee' | 'relancee' | 'entretien' | 'acceptee' | 'refusee'

// Ordre d'affichage des sections du dashboard.
export const STATUTS_SUIVI: StatutSuivi[] = ['postulee', 'relancee', 'entretien', 'acceptee', 'refusee']

export const STATUT_LABEL: Record<StatutSuivi, string> = {
  postulee: 'Postulée',
  relancee: 'Relancée',
  entretien: 'Entretien',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
}

export function estStatutSuivi(v: string): v is StatutSuivi {
  return (STATUTS_SUIVI as string[]).includes(v)
}
```

- [ ] **Step 2: Écrire le test qui échoue**

Créer `src/lib/suivi/lecture.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { getSuivi } from './lecture'

test('getSuivi ne renvoie que les candidatures suivies (statut != brouillon), jointes aux offres, triées par date', async () => {
  const rows = [
    { statut: 'postulee', postulee_le: '2026-07-10', relance_le: null, notes: null, offres: { id: 'o1', titre: 'A' } },
    { statut: 'entretien', postulee_le: '2026-07-20', relance_le: '2026-07-25', notes: 'ok', offres: { id: 'o2', titre: 'B' } },
  ]
  const neq = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eq = vi.fn(() => ({ neq }))
  const select = vi.fn(() => ({ eq }))
  const client = { from: vi.fn(() => ({ select })) } as any

  const out = await getSuivi(client, 'u1')

  expect(client.from).toHaveBeenCalledWith('candidatures')
  expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  expect(neq).toHaveBeenCalledWith('statut', 'brouillon')
  // trié par postulee_le décroissant : o2 (07-20) avant o1 (07-10)
  expect(out.map((c) => c.offre.id)).toEqual(['o2', 'o1'])
  expect(out[0]).toMatchObject({ statut: 'entretien', relance_le: '2026-07-25', notes: 'ok' })
})
```

- [ ] **Step 3: Lancer le test, vérifier qu'il échoue**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/suivi/lecture.test.ts
```
Attendu : FAIL (module `./lecture` absent).

- [ ] **Step 4: Implémenter la lecture + les helpers d'écriture**

Créer `src/lib/suivi/lecture.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import type { StatutSuivi } from './statuts'

export type CandidatureSuivi = {
  offre: OffreRow
  statut: string
  postulee_le: string | null
  relance_le: string | null
  notes: string | null
}

export async function getSuivi(client: SupabaseClient, userId: string): Promise<CandidatureSuivi[]> {
  const { data, error } = await client
    .from('candidatures')
    .select(`statut, postulee_le, relance_le, notes, offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('user_id', userId)
    .neq('statut', 'brouillon')
  if (error) throw error
  if (!data) return []
  const items = data
    .map((r: any) => {
      const offre = (Array.isArray(r.offres) ? r.offres[0] : r.offres) as OffreRow | null
      if (!offre) return null
      return { offre, statut: r.statut, postulee_le: r.postulee_le ?? null, relance_le: r.relance_le ?? null, notes: r.notes ?? null }
    })
    .filter(Boolean) as CandidatureSuivi[]
  // tri par date de candidature décroissante, nulls en fin
  return items.sort((a, b) => {
    if (!a.postulee_le && !b.postulee_le) return 0
    if (!a.postulee_le) return 1
    if (!b.postulee_le) return -1
    return b.postulee_le.localeCompare(a.postulee_le)
  })
}

async function majCandidature(
  client: SupabaseClient,
  userId: string,
  offreId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from('candidatures')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('offre_id', offreId)
  if (error) throw error
}

// Marque « postulée » sans écraser une date de candidature déjà posée.
export async function setPostulee(client: SupabaseClient, userId: string, offreId: string, dateIso: string): Promise<void> {
  await majCandidature(client, userId, offreId, { statut: 'postulee' })
  const { error } = await client
    .from('candidatures')
    .update({ postulee_le: dateIso })
    .eq('user_id', userId)
    .eq('offre_id', offreId)
    .is('postulee_le', null)
  if (error) throw error
}

export async function clearSuivi(client: SupabaseClient, userId: string, offreId: string): Promise<void> {
  await majCandidature(client, userId, offreId, { statut: 'brouillon', postulee_le: null })
}

export async function setStatut(client: SupabaseClient, userId: string, offreId: string, statut: StatutSuivi): Promise<void> {
  await majCandidature(client, userId, offreId, { statut })
}

export async function setDetailsSuivi(
  client: SupabaseClient,
  userId: string,
  offreId: string,
  patch: { notes: string | null; relance_le: string | null },
): Promise<void> {
  await majCandidature(client, userId, offreId, { notes: patch.notes, relance_le: patch.relance_le })
}
```

- [ ] **Step 5: Lancer le test, vérifier qu'il passe**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/suivi/lecture.test.ts
```
Attendu : PASS.

- [ ] **Step 6: Vérifier types**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit
```
Attendu : tsc propre.

- [ ] **Step 7: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi): statuts + getSuivi + helpers d'écriture"
```

---

### Task 3: Server Actions du suivi

**Files:**
- Create: `src/lib/suivi/actions.ts`
- Test: `src/lib/suivi/actions.test.ts`

**Interfaces:**
- Consumes: `setPostulee`, `clearSuivi`, `setStatut`, `setDetailsSuivi` de `./lecture` ; `estStatutSuivi` de `./statuts` ; `getServerClient` de `@/lib/supabase/server`.
- Produces (Server Actions) :
  - `marquerPostulee(offreId: string): Promise<void>`
  - `retirerDuSuivi(offreId: string): Promise<void>`
  - `changerStatut(offreId: string, statut: string): Promise<void>` (rejette un statut hors liste)
  - `enregistrerSuivi(offreId: string, patch: { notes: string | null; relance_le: string | null }): Promise<void>`

Note testabilité : les helpers `lecture.ts` sont déjà couverts par des tests à client injecté (Task 2 + ci-dessous). Les Server Actions étant de minces enveloppes (`getServerClient` + auth + `revalidatePath`), on teste ici la **validation de statut** de `changerStatut` de façon isolée, et on couvre les helpers d'écriture avec un faux client.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/suivi/actions.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { setPostulee, clearSuivi, setStatut, setDetailsSuivi } from './lecture'
import { estStatutSuivi } from './statuts'

function makeClient() {
  const calls: any[] = []
  const chain = (result: any = { error: null }) => {
    const c: any = {}
    c.update = vi.fn((patch: any) => { calls.push(patch); return c })
    c.eq = vi.fn(() => c)
    c.is = vi.fn(() => Promise.resolve(result))
    // update().eq().eq() doit résoudre : rendre le dernier eq thenable
    c.then = (res: any) => res(result)
    return c
  }
  const client = { from: vi.fn(() => chain()) } as any
  return { client, calls }
}

test('setPostulee met statut=postulee puis pose postulee_le si null', async () => {
  const { client, calls } = makeClient()
  await setPostulee(client, 'u1', 'o1', '2026-07-29')
  expect(calls.some((p) => p.statut === 'postulee')).toBe(true)
  expect(calls.some((p) => p.postulee_le === '2026-07-29')).toBe(true)
})

test('clearSuivi repasse en brouillon et efface postulee_le', async () => {
  const { client, calls } = makeClient()
  await clearSuivi(client, 'u1', 'o1')
  expect(calls[0]).toMatchObject({ statut: 'brouillon', postulee_le: null })
})

test('setStatut écrit le statut', async () => {
  const { client, calls } = makeClient()
  await setStatut(client, 'u1', 'o1', 'entretien')
  expect(calls[0]).toMatchObject({ statut: 'entretien' })
})

test('setDetailsSuivi écrit notes et relance_le', async () => {
  const { client, calls } = makeClient()
  await setDetailsSuivi(client, 'u1', 'o1', { notes: 'rappel', relance_le: '2026-08-01' })
  expect(calls[0]).toMatchObject({ notes: 'rappel', relance_le: '2026-08-01' })
})

test('estStatutSuivi valide la liste autorisée', () => {
  expect(estStatutSuivi('entretien')).toBe(true)
  expect(estStatutSuivi('brouillon')).toBe(false)
  expect(estStatutSuivi('n_importe_quoi')).toBe(false)
})
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/suivi/actions.test.ts
```
Attendu : FAIL au départ si un helper n'existe pas ; sinon ils passent déjà (helpers de Task 2). Si tout passe, continuer (la valeur de ce fichier est de figer le comportement). Le but réel de la tâche est l'écriture des Server Actions ci-dessous.

- [ ] **Step 3: Écrire les Server Actions**

Créer `src/lib/suivi/actions.ts` :

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { setPostulee, clearSuivi, setStatut, setDetailsSuivi } from './lecture'
import { estStatutSuivi } from './statuts'

async function userOuErreur() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  return { supabase, userId: user.id }
}

export async function marquerPostulee(offreId: string): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  const aujourdhui = new Date().toISOString().slice(0, 10)
  await setPostulee(supabase, userId, offreId, aujourdhui)
  revalidatePath('/suivi')
}

export async function retirerDuSuivi(offreId: string): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  await clearSuivi(supabase, userId, offreId)
  revalidatePath('/suivi')
}

export async function changerStatut(offreId: string, statut: string): Promise<void> {
  if (!estStatutSuivi(statut)) throw new Error('Statut invalide')
  const { supabase, userId } = await userOuErreur()
  await setStatut(supabase, userId, offreId, statut)
  revalidatePath('/suivi')
}

export async function enregistrerSuivi(
  offreId: string,
  patch: { notes: string | null; relance_le: string | null },
): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  await setDetailsSuivi(supabase, userId, offreId, patch)
  revalidatePath('/suivi')
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/suivi/actions.test.ts
```
Attendu : PASS.

- [ ] **Step 5: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 6: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi): server actions (marquerPostulee, retirerDuSuivi, changerStatut, enregistrerSuivi)"
```

---

### Task 4: Bouton « J'ai postulé » dans l'éditeur de candidature

**Files:**
- Modify: `src/components/candidature-editor.tsx`
- Test: `src/components/candidature-editor.test.tsx`

**Interfaces:**
- Consumes: `marquerPostulee`, `retirerDuSuivi` de `@/lib/suivi/actions` ; le champ `statut` de `candidatureInitiale` (type `Candidature`, déjà passé à l'éditeur) ; `Link` de `next/link`.
- Produces: dans l'état « candidature présente », un encart de suivi. Suit le statut courant en état local (`statutSuivi`), initialisé depuis `candidatureInitiale?.statut` et remis à jour après génération.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `src/components/candidature-editor.test.tsx` (garder les 3 tests existants et le `vi.mock` existant, mais compléter le mock des actions suivi) :

En tête, remplacer/compléter le mock des actions candidature par l'ajout du mock des actions suivi :

```tsx
vi.mock('@/lib/suivi/actions', () => ({
  marquerPostulee: vi.fn(),
  retirerDuSuivi: vi.fn(),
}))
```

Puis ajouter ces tests :

```tsx
test('candidature en brouillon : bouton « J\'ai postulé » présent', () => {
  const cand = { user_id: 'u1', offre_id: 'o1', email_objet: 'O', email_corps: 'C', lettre: 'L', statut: 'brouillon' }
  render(<CandidatureEditor offre={offre} profilComplet={true} candidatureInitiale={cand} />)
  expect(screen.getByRole('button', { name: /j'ai postulé/i })).toBeInTheDocument()
})

test('candidature déjà postulée : encart « dans ton suivi » + lien vers /suivi, pas de bouton « J\'ai postulé »', () => {
  const cand = { user_id: 'u1', offre_id: 'o1', email_objet: 'O', email_corps: 'C', lettre: 'L', statut: 'postulee' }
  render(<CandidatureEditor offre={offre} profilComplet={true} candidatureInitiale={cand} />)
  expect(screen.getByText(/dans ton suivi/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /voir dans le suivi/i })).toHaveAttribute('href', '/suivi')
  expect(screen.queryByRole('button', { name: /j'ai postulé/i })).toBeNull()
})
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/candidature-editor.test.tsx
```
Attendu : FAIL (bouton/encart absents).

- [ ] **Step 3: Ajouter l'état statut + les handlers**

Dans `src/components/candidature-editor.tsx` :

1. Importer les actions suivi en tête :

```tsx
import { marquerPostulee, retirerDuSuivi } from '@/lib/suivi/actions'
```

2. Ajouter un état de statut (après les autres `useState`) :

```tsx
  const [statutSuivi, setStatutSuivi] = useState<string>(candidatureInitiale?.statut ?? 'brouillon')
```

3. Dans `appliquer(c)`, synchroniser le statut (une régénération renvoie une candidature ; le statut serveur fait foi) :

```tsx
  function appliquer(c: Candidature) {
    setCand(c)
    setObjet(c.email_objet ?? '')
    setCorps(c.email_corps ?? '')
    setLettre(c.lettre ?? '')
    setStatutSuivi(c.statut ?? 'brouillon')
  }
```

4. Ajouter les handlers (après `postulerParEmail`) :

```tsx
  function jaiPostule() {
    setErreur(null)
    setStatutSuivi('postulee')
    startTransition(async () => {
      try {
        await marquerPostulee(offre.id)
      } catch {
        setStatutSuivi('brouillon')
        setErreur("Échec de l'enregistrement dans le suivi, réessaie.")
      }
    })
  }

  function retirerSuivi() {
    setErreur(null)
    setStatutSuivi('brouillon')
    startTransition(async () => {
      try {
        await retirerDuSuivi(offre.id)
      } catch {
        setStatutSuivi('postulee')
        setErreur('Échec du retrait du suivi, réessaie.')
      }
    })
  }
```

- [ ] **Step 4: Ajouter l'encart de suivi dans le rendu**

Dans le bloc `.cand-postuler` (état candidature présente), juste APRÈS la fin du contenu conditionnel `email_contact`/`url_postuler` et AVANT la fermeture `</div>` de `.cand-postuler`, ajouter l'encart de suivi :

```tsx
        <div className="cand-suivi">
          {statutSuivi === 'brouillon'
            ? (
              <button type="button" className="btn-ghost" onClick={jaiPostule} disabled={isPending}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                J&apos;ai postulé
              </button>
            )
            : (
              <div className="cand-suivi-ok">
                <span className="cand-suivi-badge">Dans ton suivi ✓</span>
                <Link href="/suivi" className="cand-suivi-link">Voir dans le suivi</Link>
                <button type="button" className="cand-suivi-retirer" onClick={retirerSuivi} disabled={isPending}>Retirer du suivi</button>
              </div>
            )}
        </div>
```

- [ ] **Step 5: Lancer les tests, vérifier qu'ils passent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/candidature-editor.test.tsx
```
Attendu : PASS (les 3 tests existants + les 2 nouveaux).

- [ ] **Step 6: Ajouter les styles de l'encart**

Dans `src/app/globals.css`, ajouter à la fin :

```css
/* Encart suivi dans le bloc Postuler */
.cand-suivi { margin-top: 6px; display: flex; justify-content: center; }
.cand-suivi-ok { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: center; }
.cand-suivi-badge { font-size: .88rem; font-weight: 700; color: var(--accent-dark); }
.cand-suivi-link { font-size: .85rem; font-weight: 600; color: var(--accent-dark); text-decoration: underline; }
.cand-suivi-retirer {
  font-size: .8rem; color: var(--muted); background: none; border: 0; cursor: pointer; text-decoration: underline;
}
.cand-suivi-retirer:hover { color: #e2565b; }
```

- [ ] **Step 7: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 8: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi): bouton J'ai postulé + encart suivi dans l'éditeur de candidature"
```

---

### Task 5: Dashboard `/suivi` (liste + carte + styles)

**Files:**
- Create: `src/app/suivi/page.tsx`
- Create: `src/components/suivi-liste.tsx`
- Create: `src/components/suivi-carte.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/suivi-liste.test.tsx`, `src/components/suivi-carte.test.tsx`

**Interfaces:**
- Consumes: `getServerClient` ; `getSuivi`, `CandidatureSuivi` de `@/lib/suivi/lecture` ; `STATUTS_SUIVI`, `STATUT_LABEL`, `StatutSuivi` de `@/lib/suivi/statuts` ; `changerStatut`, `enregistrerSuivi` de `@/lib/suivi/actions` ; `PageHeader` de `@/components/page-header` ; `OffreRow`.
- Produces: `SuiviListe({ items }: { items: CandidatureSuivi[] })` ; `SuiviCarte({ item }: { item: CandidatureSuivi })`.

- [ ] **Step 1: Écrire le test de la carte (échoue)**

Créer `src/components/suivi-carte.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import SuiviCarte from './suivi-carte'
import type { CandidatureSuivi } from '@/lib/suivi/lecture'

const changerStatut = vi.fn().mockResolvedValue(undefined)
const enregistrerSuivi = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/suivi/actions', () => ({
  changerStatut: (...a: unknown[]) => changerStatut(...a),
  enregistrerSuivi: (...a: unknown[]) => enregistrerSuivi(...a),
}))

const item: CandidatureSuivi = {
  offre: {
    id: 'o1', source: 'x', source_id: 'x', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
    description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: 'Nantes',
    url_postuler: null, email_contact: null, date_publication: null,
  },
  statut: 'postulee', postulee_le: '2026-07-10', relance_le: null, notes: null,
}

test('affiche le titre, l\'employeur et un sélecteur de statut', () => {
  render(<SuiviCarte item={item} />)
  expect(screen.getByText('Diététicien')).toBeInTheDocument()
  expect(screen.getByText(/Clinique/)).toBeInTheDocument()
  expect(screen.getByLabelText(/statut/i)).toBeInTheDocument()
})

test('changer le statut appelle changerStatut', async () => {
  const user = userEvent.setup()
  render(<SuiviCarte item={item} />)
  await user.selectOptions(screen.getByLabelText(/statut/i), 'entretien')
  expect(changerStatut).toHaveBeenCalledWith('o1', 'entretien')
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/suivi-carte.test.tsx
```
Attendu : FAIL (composant absent).

- [ ] **Step 3: Implémenter `SuiviCarte`**

Créer `src/components/suivi-carte.tsx` :

```tsx
'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { CandidatureSuivi } from '@/lib/suivi/lecture'
import { STATUTS_SUIVI, STATUT_LABEL, type StatutSuivi } from '@/lib/suivi/statuts'
import { changerStatut, enregistrerSuivi } from '@/lib/suivi/actions'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SuiviCarte({ item }: { item: CandidatureSuivi }) {
  const [statut, setStatut] = useState(item.statut)
  const [relance, setRelance] = useState(item.relance_le ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [, startTransition] = useTransition()
  const o = item.offre
  const classeStatut = `st-${statut}`

  function onStatut(v: string) {
    setStatut(v)
    startTransition(async () => {
      try { await changerStatut(o.id, v) } catch { setStatut(item.statut) }
    })
  }

  function sauverDetails(nextNotes: string, nextRelance: string) {
    startTransition(async () => {
      try {
        await enregistrerSuivi(o.id, { notes: nextNotes || null, relance_le: nextRelance || null })
      } catch { /* non bloquant */ }
    })
  }

  return (
    <div className={`suivi-carte ${classeStatut}`}>
      <div className="suivi-carte-top">
        <div className="suivi-carte-head">
          <Link href={`/offre/${o.id}`} className="suivi-carte-titre">{o.titre}</Link>
          <div className="suivi-carte-emp">
            <b>{o.entreprise ?? 'Employeur non précisé'}</b>{o.ville ? ` · ${o.ville}` : ''}
          </div>
          {item.postulee_le && <div className="suivi-carte-date">Postulée le {formatDate(item.postulee_le)}</div>}
        </div>
        <label className="suivi-carte-statut">
          <span className="sr-label">Statut</span>
          <select value={statut} onChange={(e) => onStatut(e.target.value)}>
            {STATUTS_SUIVI.map((s: StatutSuivi) => (
              <option key={s} value={s}>{STATUT_LABEL[s]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="suivi-carte-details">
        <label className="suivi-champ">
          <span>Relance prévue</span>
          <input type="date" value={relance}
            onChange={(e) => setRelance(e.target.value)}
            onBlur={(e) => sauverDetails(notes, e.target.value)} />
        </label>
        <label className="suivi-champ grow">
          <span>Notes</span>
          <textarea rows={2} value={notes} placeholder="Contact, ressenti, prochaine étape…"
            onChange={(e) => setNotes(e.target.value)}
            onBlur={(e) => sauverDetails(e.target.value, relance)} />
        </label>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/suivi-carte.test.tsx
```
Attendu : PASS.

- [ ] **Step 5: Écrire le test de la liste (échoue)**

Créer `src/components/suivi-liste.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import SuiviListe from './suivi-liste'
import type { CandidatureSuivi } from '@/lib/suivi/lecture'

vi.mock('@/lib/suivi/actions', () => ({
  changerStatut: vi.fn(), enregistrerSuivi: vi.fn(),
}))

function item(id: string, statut: string): CandidatureSuivi {
  return {
    offre: {
      id, source: 'x', source_id: id, titre: `Offre ${id}`, entreprise: 'E', entreprise_logo: null,
      description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: null,
      url_postuler: null, email_contact: null, date_publication: null,
    },
    statut, postulee_le: '2026-07-10', relance_le: null, notes: null,
  }
}

test('état vide quand aucune candidature', () => {
  render(<SuiviListe items={[]} />)
  expect(screen.getByText(/aucune candidature/i)).toBeInTheDocument()
})

test('affiche les compteurs et une section par statut présent', () => {
  render(<SuiviListe items={[item('a', 'postulee'), item('b', 'entretien'), item('c', 'entretien')]} />)
  // section Entretien avec 2 éléments
  expect(screen.getByRole('heading', { name: /entretien/i })).toBeInTheDocument()
  // compteur « En cours » = postulee + entretien = 3
  expect(screen.getByText('En cours').previousSibling?.textContent ?? screen.getByText('En cours').parentElement?.textContent).toContain('3')
  // pas de section Refusée (aucun élément)
  expect(screen.queryByRole('heading', { name: /refusée/i })).toBeNull()
})
```

- [ ] **Step 6: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/suivi-liste.test.tsx
```
Attendu : FAIL (composant absent).

- [ ] **Step 7: Implémenter `SuiviListe`**

Créer `src/components/suivi-liste.tsx` :

```tsx
import type { CandidatureSuivi } from '@/lib/suivi/lecture'
import { STATUTS_SUIVI, STATUT_LABEL, type StatutSuivi } from '@/lib/suivi/statuts'
import SuiviCarte from './suivi-carte'

export default function SuiviListe({ items }: { items: CandidatureSuivi[] }) {
  if (items.length === 0) {
    return (
      <div className="suivi-empty">
        <div className="suivi-empty-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>
        </div>
        <h2>Aucune candidature suivie</h2>
        <p>Quand tu postules à une offre et cliques « J&apos;ai postulé », elle apparaît ici pour que tu suives son avancement.</p>
        <a href="/" className="btn-primary">Chercher des offres</a>
      </div>
    )
  }

  const parStatut = (s: StatutSuivi) => items.filter((i) => i.statut === s)
  const nb = (ss: StatutSuivi[]) => items.filter((i) => ss.includes(i.statut as StatutSuivi)).length
  const enCours = nb(['postulee', 'relancee', 'entretien'])
  const entretiens = nb(['entretien'])
  const reponses = nb(['acceptee', 'refusee'])

  return (
    <div className="suivi-dash">
      <div className="suivi-stats">
        <div className="suivi-stat"><b>{items.length}</b><span>Total</span></div>
        <div className="suivi-stat"><b>{enCours}</b><span>En cours</span></div>
        <div className="suivi-stat"><b>{entretiens}</b><span>Entretiens</span></div>
        <div className="suivi-stat"><b>{reponses}</b><span>Réponses</span></div>
      </div>

      {STATUTS_SUIVI.map((s) => {
        const list = parStatut(s)
        if (list.length === 0) return null
        return (
          <section key={s} className={`suivi-section st-${s}`}>
            <div className="suivi-section-head">
              <span className="suivi-dot" />
              <h3>{STATUT_LABEL[s]}</h3>
              <span className="suivi-section-count">{list.length}</span>
            </div>
            <div className="suivi-cards">
              {list.map((i) => <SuiviCarte key={i.offre.id} item={i} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 8: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/suivi-liste.test.tsx
```
Attendu : PASS.

- [ ] **Step 9: Créer la page serveur**

Créer `src/app/suivi/page.tsx` :

```tsx
import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getSuivi } from '@/lib/suivi/lecture'
import SuiviListe from '@/components/suivi-liste'
import PageHeader from '@/components/page-header'

export default async function SuiviPage() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const items = await getSuivi(supabase, user.id)

  return (
    <section className="screen on">
      <PageHeader titre="Retour" />
      <div className="detail-scroll">
        <div className="detail-hero">
          <header className="detail-head">
            <div className="d-titletext">
              <h1>Suivi des candidatures</h1>
              <div className="d-emp">Ton tableau de bord de recherche d&apos;emploi</div>
            </div>
          </header>
        </div>
        <div className="detail-wrap">
          <SuiviListe items={items} />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 10: Ajouter les styles du dashboard**

Dans `src/app/globals.css`, ajouter à la fin (pastilles de statut + cartes ; réutilise les variables existantes) :

```css
/* ── Dashboard suivi ─────────────────────────────────────────────────── */
.sr-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.suivi-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 12px; max-width: 460px; margin: 30px auto 60px;
}
.suivi-empty-ico { width: 72px; height: 72px; border-radius: 20px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
.suivi-empty-ico svg { width: 34px; height: 34px; }
.suivi-empty h2 { font-size: 1.35rem; font-weight: 800; }
.suivi-empty p { font-size: .94rem; color: var(--muted); line-height: 1.55; }
.suivi-empty .btn-primary { margin-top: 6px; }

.suivi-dash { display: flex; flex-direction: column; gap: 26px; padding-bottom: 56px; }
.suivi-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.suivi-stat {
  display: flex; flex-direction: column; gap: 2px; align-items: flex-start;
  background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 15px 17px;
  box-shadow: var(--shadow-sm);
}
.suivi-stat b { font-size: 1.5rem; font-weight: 800; letter-spacing: -.02em; }
.suivi-stat span { font-size: .8rem; color: var(--muted); font-weight: 600; }
@media (max-width: 620px) { .suivi-stats { grid-template-columns: repeat(2, 1fr); } }

.suivi-section-head { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
.suivi-section-head h3 { font-size: 1.02rem; font-weight: 700; }
.suivi-section-count {
  font-size: .74rem; font-weight: 700; color: var(--muted);
  background: #f1f2f1; border-radius: 999px; padding: 2px 9px;
}
.suivi-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
.suivi-cards { display: flex; flex-direction: column; gap: 12px; }

.suivi-carte {
  background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--line);
  border-radius: 14px; padding: 15px 17px; box-shadow: var(--shadow-sm);
}
.suivi-carte-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.suivi-carte-titre { font-size: 1rem; font-weight: 700; color: var(--ink); text-decoration: none; }
.suivi-carte-titre:hover { color: var(--accent-dark); }
.suivi-carte-emp { font-size: .86rem; color: var(--muted); margin-top: 2px; }
.suivi-carte-date { font-size: .78rem; color: var(--muted); margin-top: 4px; }
.suivi-carte-statut select {
  font-family: inherit; font-size: .84rem; font-weight: 600; color: var(--ink);
  border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; background: #fff; cursor: pointer; outline: none;
}
.suivi-carte-statut select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.suivi-carte-details { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 13px; }
.suivi-champ { display: flex; flex-direction: column; gap: 5px; }
.suivi-champ.grow { flex: 1; min-width: 200px; }
.suivi-champ span { font-size: .74rem; font-weight: 600; color: var(--muted); }
.suivi-champ input, .suivi-champ textarea {
  font-family: inherit; font-size: .86rem; color: var(--ink); background: #fff;
  border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px; outline: none; resize: vertical;
}
.suivi-champ input:focus, .suivi-champ textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

/* Couleurs par statut : liseré de carte + pastille de section */
.st-postulee.suivi-carte { border-left-color: #3b82f6; }
.st-postulee .suivi-dot { background: #3b82f6; }
.st-relancee.suivi-carte { border-left-color: #d99a2b; }
.st-relancee .suivi-dot { background: #d99a2b; }
.st-entretien.suivi-carte { border-left-color: #8b5cf6; }
.st-entretien .suivi-dot { background: #8b5cf6; }
.st-acceptee.suivi-carte { border-left-color: var(--accent); }
.st-acceptee .suivi-dot { background: var(--accent); }
.st-refusee.suivi-carte { border-left-color: #e2565b; }
.st-refusee .suivi-dot { background: #e2565b; }
```

- [ ] **Step 11: Vérifier types + suite complète + build**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run && npx next build
```
Attendu : tsc propre, suite verte, build OK (route `/suivi` présente).

- [ ] **Step 12: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi): dashboard /suivi (compteurs + sections par statut + carte éditable)"
```

---

### Task 6: Accès au suivi (menu compte + accueil)

**Files:**
- Modify: `src/components/compte-menu.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: routes `/suivi` (Task 5).
- Produces: liens de navigation vers `/suivi`.

- [ ] **Step 1: Ajouter le lien dans le menu compte**

Dans `src/components/compte-menu.tsx`, ajouter une entrée de menu après le lien « Mes offres likées » (le bloc `<a href="/favoris">…</a>`) :

```tsx
        <a href="/suivi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
          <span>Suivi des candidatures</span>
        </a>
```

- [ ] **Step 2: Ajouter un lien discret sur l'accueil**

Dans `src/app/page.tsx`, ajouter un lien discret sous la barre de recherche. Importer `Link` en tête :

```tsx
import Link from 'next/link'
```

Puis remplacer `<SearchBar />` par un fragment qui ajoute le lien dessous :

```tsx
      <SearchBar />
      <Link href="/suivi" className="accueil-suivi-link">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
        Suivi de mes candidatures
      </Link>
```

- [ ] **Step 3: Ajouter le style du lien accueil**

Dans `src/app/globals.css`, ajouter à la fin :

```css
.accueil-suivi-link {
  position: absolute; bottom: 34px; left: 50%; transform: translateX(-50%);
  z-index: 1; display: inline-flex; align-items: center; gap: 7px;
  font-size: .85rem; font-weight: 600; color: var(--muted); text-decoration: none;
  padding: 8px 14px; border-radius: 999px; transition: color .15s, background .15s;
}
.accueil-suivi-link:hover { color: var(--accent-dark); background: var(--accent-soft); }
```

- [ ] **Step 4: Vérifier types + suite + build**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run && npx next build
```
Attendu : tsc propre, suite verte, build OK.

- [ ] **Step 5: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi): accès au suivi depuis le menu compte et l'accueil"
```

---

## Notes de fin de plan (hors tâches)

- **Migration à appliquer sur Supabase distant après merge** : `0007_suivi.sql` (colonnes `notes`, `relance_le`, `postulee_le`).
- **Dépendance inter-briques** : cette brique modifie `upsertCandidature` (Brique 4) pour préserver le statut. Sans ce correctif, marquer « J'ai postulé » puis enregistrer une édition ferait ressortir la candidature du suivi.
- **RLS** : aucune nouvelle policy ; `candidatures_self` couvre lectures et écritures du suivi.
