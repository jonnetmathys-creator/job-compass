# JobCompass · Brique 6 : Suivi 2.0 · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le suivi complet et logique : marquer « postulé » depuis la page offre, ajouter des candidatures manuelles, dates + relance conseillée automatique (+10 j) avec mail de relance IA enregistré, et un dashboard plus lisible.

**Architecture:** On étend la table `candidatures` (mail de relance) et on autorise des offres `source='manuelle'`. Des fonctions pures de dates pilotent la relance. La couche `src/lib/suivi/*` (client injecté) gagne l'upsert « postulé », l'ajout/suppression manuel et la génération de relance (Gemini texte). Un composant réutilisable `PostulerToggle` unifie le geste « J'ai postulé » sur la page offre et la page candidature. Le dashboard affiche jours écoulés, badge « à relancer » et l'ajout manuel.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `params` = Promise), React 19, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Google Gemini `gemini-flash-latest` (texte, JSON), Vitest + @testing-library/react.

## Global Constraints

- **Spec de référence :** `docs/superpowers/specs/2026-07-29-jobcompass-mvp-6-suivi2-design.md`. En cas de doute, la spec prime.
- **Aucune nouvelle dépendance npm.** `crypto.randomUUID()` (natif Node/serveur) pour les ids d'offres manuelles.
- **Statuts** : `postulee`, `relancee`, `entretien`, `acceptee`, `refusee` (ordre d'affichage) ; `brouillon` = hors suivi. Définis dans `src/lib/suivi/statuts.ts` (existant).
- **Délai de relance conseillé : 10 jours** après `postulee_le`.
- **Modèle Gemini** : `gemini-flash-latest` (le seul avec quota gratuit sur la clé ; `gemini-2.0-flash` renvoie `limit: 0`). Endpoint v1beta, clé en header `x-goog-api-key`, **côté serveur uniquement** via `requireEnv('GEMINI_API_KEY')`. Constantes `MODEL`/`ENDPOINT` déjà dans `src/lib/candidature/gemini.ts`.
- **Tout module Vitest DOIT importer explicitement ses helpers** : `import { expect, test, vi } from 'vitest'` (ou sous-ensemble). tsconfig inclut `**/*.ts`.
- **TS gotcha** : un mock `vi.fn(() => ...)` (zéro arg) déstructuré via `.mock.calls[0]` casse (TS2493) ; élargir en `vi.fn((..._args: unknown[]) => ...)`.
- **Server Actions (`'use server'`)** : un fichier `'use server'` n'exporte QUE des fonctions `async`. La logique testable (client injecté) vit dans des modules SANS `'use server'` ; `actions.ts` (avec `'use server'`) enveloppe avec auth + `revalidatePath`. `revalidatePath` hors try/catch.
- **Français** dans toute copie visible. **Jamais de tiret cadratin `—`** : utiliser `:`, `,` ou `·`.
- **Injection de dépendances** : tout accès Supabase / `fetch` passe par un client/impl injecté.
- **RLS** : `candidatures_self` couvre les candidatures ; la migration ajoute des policies `offres` limitées à `source='manuelle'` pour l'ajout/suppression manuel.
- **Migrations** : `supabase/migrations/000N_*.sql` numérotés à la suite (dernier = `0007`). Appliquées manuellement sur Supabase distant après merge.

---

## File Structure

**Créés :**
- `supabase/migrations/0008_suivi2.sql` : `candidatures.relance_objet/relance_corps` + policies insert/delete `offres` manuelle.
- `src/lib/suivi/dates.ts` : `ajouterJours`, `joursDepuis`, `estARelancer` (purs).
- `src/lib/suivi/manuelle.ts` : `creerCandidatureManuelle`.
- `src/lib/suivi/relance.ts` : `RELANCE_SCHEMA`, `buildPromptRelance`, `genererRelanceCore`.
- `src/components/postuler-toggle.tsx` : bouton « J'ai postulé » réutilisable (client).
- `src/components/ajout-candidature.tsx` : formulaire d'ajout manuel (client).
- Tests colocalisés.

**Modifiés :**
- `src/lib/suivi/lecture.ts` : `setPostulee` create-or-update (+ `relanceIso`), `supprimerCandidature`, `setRelanceEmail`, `getSuivi` élargi (`relance_objet/corps`), type `CandidatureSuivi`.
- `src/lib/suivi/actions.ts` : `marquerPostulee` (relance +10 j), `ajouterCandidatureManuelle`, `supprimerCandidature`, `genererRelance`, `enregistrerRelance`.
- `src/lib/candidature/gemini.ts` : `appelerGeminiJson`.
- `src/components/offre-detail.tsx` + `src/app/offre/[id]/page.tsx` : `PostulerToggle` (charge le statut).
- `src/components/candidature-editor.tsx` : remplace l'encart bespoke par `PostulerToggle`.
- `src/components/suivi-carte.tsx` + `src/components/suivi-liste.tsx` + `src/app/globals.css` : refonte (jours, relance, mail de relance, suppression, ajout, bandeau).

---

### Task 1: Dates utilitaires + migration 0008

**Files:**
- Create: `src/lib/suivi/dates.ts`
- Create: `supabase/migrations/0008_suivi2.sql`
- Test: `src/lib/suivi/dates.test.ts`

**Interfaces:**
- Produces :
  - `ajouterJours(dateIso: string, n: number): string` (date `yyyy-mm-dd` décalée de n jours)
  - `joursDepuis(dateIso: string, todayIso: string): number`
  - `estARelancer(statut: string, relanceLe: string | null, todayIso: string): boolean`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/suivi/dates.test.ts` :

```ts
import { expect, test } from 'vitest'
import { ajouterJours, joursDepuis, estARelancer } from './dates'

test('ajouterJours décale la date et gère le passage de mois', () => {
  expect(ajouterJours('2026-07-10', 10)).toBe('2026-07-20')
  expect(ajouterJours('2026-07-25', 10)).toBe('2026-08-04')
})

test('joursDepuis compte les jours écoulés', () => {
  expect(joursDepuis('2026-07-10', '2026-07-10')).toBe(0)
  expect(joursDepuis('2026-07-10', '2026-07-13')).toBe(3)
})

test('estARelancer : postulee et échéance atteinte', () => {
  expect(estARelancer('postulee', '2026-07-20', '2026-07-20')).toBe(true)
  expect(estARelancer('postulee', '2026-07-20', '2026-07-25')).toBe(true)
  expect(estARelancer('postulee', '2026-07-20', '2026-07-19')).toBe(false)
  expect(estARelancer('entretien', '2026-07-20', '2026-07-25')).toBe(false)
  expect(estARelancer('postulee', null, '2026-07-25')).toBe(false)
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/suivi/dates.test.ts
```
Attendu : FAIL (module absent).

- [ ] **Step 3: Implémenter**

Créer `src/lib/suivi/dates.ts` :

```ts
// Fonctions de dates pures (UTC, format yyyy-mm-dd) pour éviter les décalages de fuseau.

export function ajouterJours(dateIso: string, n: number): string {
  const d = new Date(dateIso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function joursDepuis(dateIso: string, todayIso: string): number {
  const a = new Date(dateIso + 'T00:00:00Z').getTime()
  const b = new Date(todayIso + 'T00:00:00Z').getTime()
  return Math.floor((b - a) / 86400000)
}

// Une candidature est « à relancer » si elle est encore en attente (postulee),
// a une date de relance posée, et cette date est atteinte ou dépassée.
export function estARelancer(statut: string, relanceLe: string | null, todayIso: string): boolean {
  return statut === 'postulee' && !!relanceLe && relanceLe <= todayIso
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/suivi/dates.test.ts
```
Attendu : PASS.

- [ ] **Step 5: Écrire la migration**

Créer `supabase/migrations/0008_suivi2.sql` :

```sql
-- Mail de relance IA enregistré par candidature.
alter table public.candidatures add column if not exists relance_objet text;
alter table public.candidatures add column if not exists relance_corps text;

-- Candidatures manuelles : un utilisateur authentifié peut insérer et supprimer
-- une offre « manuelle » (saisie par lui, hors France Travail). Les offres
-- collectées restent gérées par le service role (bypass RLS).
create policy offres_insert_manuelle on public.offres
  for insert to authenticated
  with check (source = 'manuelle');

create policy offres_delete_manuelle on public.offres
  for delete to authenticated
  using (source = 'manuelle');
```

- [ ] **Step 6: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 7: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi2): dates utilitaires + migration 0008 (relance + offres manuelles)"
```

---

### Task 2: setPostulee create-or-update + relance auto

**Files:**
- Modify: `src/lib/suivi/lecture.ts`
- Modify: `src/lib/suivi/actions.ts`
- Test: `src/lib/suivi/postulee.test.ts`

**Interfaces:**
- Consumes: `ajouterJours` de `./dates`.
- Produces: `setPostulee(client, userId, offreId, dateIso, relanceIso)` **create-or-update** : garantit la ligne, promeut `brouillon→postulee`, pose `postulee_le`/`relance_le` si absents. `marquerPostulee(offreId)` calcule `relanceIso = ajouterJours(today, 10)`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/suivi/postulee.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { setPostulee } from './lecture'

function makeClient() {
  const updates: Record<string, unknown>[] = []
  const upserts: { payload: unknown; opts: unknown }[] = []
  const node = () => {
    const n: any = {}
    n.upsert = (payload: unknown, opts: unknown) => { upserts.push({ payload, opts }); return Promise.resolve({ error: null }) }
    n.update = (p: Record<string, unknown>) => { updates.push(p); return n }
    n.eq = () => n
    n.is = () => Promise.resolve({ error: null })
    n.then = (res: (v: { error: null }) => void) => res({ error: null })
    return n
  }
  const client = { from: vi.fn(() => node()) } as any
  return { client, updates, upserts }
}

test('setPostulee garantit la ligne, promeut le statut, pose les dates si absentes', async () => {
  const { client, updates, upserts } = makeClient()
  await setPostulee(client, 'u1', 'o1', '2026-07-10', '2026-07-20')

  // 1. upsert insert-or-ignore pour garantir l'existence
  expect(upserts[0].opts).toMatchObject({ onConflict: 'user_id,offre_id', ignoreDuplicates: true })
  // 2. promotion brouillon -> postulee
  expect(updates.some((p) => p.statut === 'postulee')).toBe(true)
  // 3. dates posées
  expect(updates.some((p) => p.postulee_le === '2026-07-10')).toBe(true)
  expect(updates.some((p) => p.relance_le === '2026-07-20')).toBe(true)
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/suivi/postulee.test.ts
```
Attendu : FAIL (`setPostulee` a l'ancienne signature / comportement).

- [ ] **Step 3: Réécrire `setPostulee`**

Dans `src/lib/suivi/lecture.ts`, remplacer la fonction `setPostulee` par :

```ts
// Marque « postulée » : crée la candidature si absente, promeut brouillon -> postulee
// sans rétrograder un statut plus avancé, et pose postulee_le / relance_le si absents.
export async function setPostulee(
  client: SupabaseClient,
  userId: string,
  offreId: string,
  dateIso: string,
  relanceIso: string,
): Promise<void> {
  const { error: e1 } = await client
    .from('candidatures')
    .upsert({ user_id: userId, offre_id: offreId }, { onConflict: 'user_id,offre_id', ignoreDuplicates: true })
  if (e1) throw e1
  const { error: e2 } = await client
    .from('candidatures')
    .update({ statut: 'postulee', updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('offre_id', offreId).eq('statut', 'brouillon')
  if (e2) throw e2
  const { error: e3 } = await client
    .from('candidatures')
    .update({ postulee_le: dateIso })
    .eq('user_id', userId).eq('offre_id', offreId).is('postulee_le', null)
  if (e3) throw e3
  const { error: e4 } = await client
    .from('candidatures')
    .update({ relance_le: relanceIso })
    .eq('user_id', userId).eq('offre_id', offreId).is('relance_le', null)
  if (e4) throw e4
}
```

- [ ] **Step 4: Mettre à jour `marquerPostulee`**

Dans `src/lib/suivi/actions.ts`, importer `ajouterJours` et passer la date de relance :

```ts
import { ajouterJours } from './dates'
```

```ts
export async function marquerPostulee(offreId: string): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const relance = ajouterJours(aujourdhui, 10)
  await setPostulee(supabase, userId, offreId, aujourdhui, relance)
  revalidatePath('/suivi')
}
```

- [ ] **Step 5: Lancer, vérifier le succès + suite**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/suivi/postulee.test.ts && npx tsc --noEmit && npx vitest run
```
Attendu : PASS, tsc propre, suite verte.

- [ ] **Step 6: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi2): marquer postulé crée la candidature + relance auto +10j"
```

---

### Task 3: Candidature manuelle (création + suppression)

**Files:**
- Create: `src/lib/suivi/manuelle.ts`
- Modify: `src/lib/suivi/lecture.ts` (ajout `supprimerCandidature`)
- Modify: `src/lib/suivi/actions.ts` (actions `ajouterCandidatureManuelle`, `supprimerCandidature`)
- Test: `src/lib/suivi/manuelle.test.ts`

**Interfaces:**
- Consumes: `ajouterJours` de `./dates`.
- Produces:
  - `type FormManuelle = { titre: string; entreprise: string; ville: string; url: string; dateIso: string }`
  - `creerCandidatureManuelle(client, userId, form: FormManuelle): Promise<string>` (renvoie l'`offreId` créé)
  - `supprimerCandidature(client, userId, offreId): Promise<void>` (dans `lecture.ts`)
  - Server Actions `ajouterCandidatureManuelle(form)`, `supprimerCandidature(offreId)`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/suivi/manuelle.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { creerCandidatureManuelle } from './manuelle'
import { supprimerCandidature } from './lecture'

test('creerCandidatureManuelle insère une offre manuelle puis la candidature', async () => {
  const inserts: { table: string; payload: any }[] = []
  const single = vi.fn().mockResolvedValue({ data: { id: 'offre-123' }, error: null })
  const client: any = {
    from: vi.fn((table: string) => ({
      insert: (payload: any) => {
        inserts.push({ table, payload })
        return { select: () => ({ single }), then: (res: any) => res({ error: null }) }
      },
    })),
  }

  const offreId = await creerCandidatureManuelle(client, 'u1', {
    titre: 'Diététicien', entreprise: 'Clinique', ville: 'Nantes', url: 'https://x.fr', dateIso: '2026-07-10',
  })

  expect(offreId).toBe('offre-123')
  const offreInsert = inserts.find((i) => i.table === 'offres')!.payload
  expect(offreInsert).toMatchObject({ source: 'manuelle', titre: 'Diététicien', entreprise: 'Clinique', ville: 'Nantes', url_postuler: 'https://x.fr' })
  expect(typeof offreInsert.source_id).toBe('string')
  const candInsert = inserts.find((i) => i.table === 'candidatures')!.payload
  expect(candInsert).toMatchObject({ user_id: 'u1', offre_id: 'offre-123', statut: 'postulee', postulee_le: '2026-07-10', relance_le: '2026-07-20' })
})

test('supprimerCandidature supprime la candidature puis l\'offre si manuelle', async () => {
  const deletes: string[] = []
  const single = vi.fn().mockResolvedValue({ data: { source: 'manuelle' }, error: null })
  const client: any = {
    from: vi.fn((table: string) => ({
      select: () => ({ eq: () => ({ single }) }),
      delete: () => {
        deletes.push(table)
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }), then: (r: any) => r({ error: null }) }), then: (r: any) => r({ error: null }) }
      },
    })),
  }

  await supprimerCandidature(client, 'u1', 'offre-123')
  expect(deletes).toContain('candidatures')
  expect(deletes).toContain('offres')
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/suivi/manuelle.test.ts
```
Attendu : FAIL (modules/fonctions absents).

- [ ] **Step 3: Implémenter `creerCandidatureManuelle`**

Créer `src/lib/suivi/manuelle.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { ajouterJours } from './dates'

export type FormManuelle = {
  titre: string
  entreprise: string
  ville: string
  url: string
  dateIso: string
}

export async function creerCandidatureManuelle(
  client: SupabaseClient,
  userId: string,
  form: FormManuelle,
): Promise<string> {
  const { data, error } = await client
    .from('offres')
    .insert({
      source: 'manuelle',
      source_id: crypto.randomUUID(),
      titre: form.titre,
      entreprise: form.entreprise || null,
      ville: form.ville || null,
      url_postuler: form.url || null,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('Création de l\'offre manuelle échouée')
  const offreId = data.id as string

  const { error: e2 } = await client.from('candidatures').insert({
    user_id: userId,
    offre_id: offreId,
    statut: 'postulee',
    postulee_le: form.dateIso,
    relance_le: ajouterJours(form.dateIso, 10),
  })
  if (e2) throw e2
  return offreId
}
```

- [ ] **Step 4: Implémenter `supprimerCandidature`**

Dans `src/lib/suivi/lecture.ts`, ajouter :

```ts
export async function supprimerCandidature(client: SupabaseClient, userId: string, offreId: string): Promise<void> {
  // Récupère la source de l'offre avant suppression (pour nettoyer une offre manuelle).
  const { data: off } = await client.from('offres').select('source').eq('id', offreId).single()
  const { error } = await client.from('candidatures').delete().eq('user_id', userId).eq('offre_id', offreId)
  if (error) throw error
  if (off?.source === 'manuelle') {
    // RLS offres_delete_manuelle autorise la suppression d'une offre manuelle.
    await client.from('offres').delete().eq('id', offreId)
  }
}
```

- [ ] **Step 5: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/suivi/manuelle.test.ts
```
Attendu : PASS.

- [ ] **Step 6: Ajouter les Server Actions**

Dans `src/lib/suivi/actions.ts`, importer et ajouter :

```ts
import { creerCandidatureManuelle, type FormManuelle } from './manuelle'
import { supprimerCandidature as supprimerCandidatureDb } from './lecture'
```

```ts
export async function ajouterCandidatureManuelle(form: FormManuelle): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  await creerCandidatureManuelle(supabase, userId, form)
  revalidatePath('/suivi')
}

export async function supprimerCandidature(offreId: string): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  await supprimerCandidatureDb(supabase, userId, offreId)
  revalidatePath('/suivi')
}
```

- [ ] **Step 7: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 8: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi2): candidature manuelle (création + suppression)"
```

---

### Task 4: Mail de relance IA

**Files:**
- Modify: `src/lib/candidature/gemini.ts` (ajout `appelerGeminiJson`)
- Create: `src/lib/suivi/relance.ts`
- Modify: `src/lib/suivi/lecture.ts` (`setRelanceEmail` + `getSuivi` élargi + type)
- Modify: `src/lib/suivi/actions.ts` (`genererRelance`, `enregistrerRelance`)
- Test: `src/lib/candidature/gemini.test.ts` (ajout), `src/lib/suivi/relance.test.ts`

**Interfaces:**
- Consumes: `requireEnv` de `@/lib/env` ; `MODEL`/`ENDPOINT` de `gemini.ts` ; `getProfil` de `@/lib/profil`.
- Produces:
  - `appelerGeminiJson<T>(prompt: string, schema: object, deps?: { fetchImpl?: typeof fetch }): Promise<T>` (dans `gemini.ts`)
  - `type RelanceContenu = { objet: string; corps: string }`
  - `RELANCE_SCHEMA` (objet JSON schema)
  - `buildPromptRelance(offre: { titre: string; entreprise: string | null; ville: string | null }, profil: { nom: string | null }, emailInitial: string | null): string`
  - `genererRelanceCore(deps: { client: SupabaseClient; userId: string; offreId: string; appelerImpl?: typeof appelerGeminiJson }): Promise<RelanceContenu>`
  - `setRelanceEmail(client, userId, offreId, { objet, corps }): Promise<void>` (dans `lecture.ts`)
  - `CandidatureSuivi` gagne `relance_objet: string | null; relance_corps: string | null`
  - Server Actions `genererRelance(offreId): Promise<RelanceContenu>`, `enregistrerRelance(offreId, { objet, corps }): Promise<void>`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `src/lib/candidature/gemini.test.ts` (le fichier définit déjà `process.env.GEMINI_API_KEY ??= 'test-key'` en tête ; sinon l'ajouter) :

```ts
import { appelerGeminiJson } from './gemini'

test('appelerGeminiJson poste le prompt + schéma et parse le JSON', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: '{"objet":"O","corps":"C"}' }] } }] }),
  })
  const schema = { type: 'OBJECT', properties: { objet: { type: 'STRING' }, corps: { type: 'STRING' } }, required: ['objet', 'corps'] }
  const out = await appelerGeminiJson<{ objet: string; corps: string }>('un prompt', schema, { fetchImpl: fetchImpl as any })

  expect(out).toEqual({ objet: 'O', corps: 'C' })
  const [url, init] = fetchImpl.mock.calls[0]
  expect(String(url)).toContain('gemini-flash-latest')
  const body = JSON.parse(init.body)
  expect(body.contents[0].parts[0].text).toBe('un prompt')
  expect(body.generationConfig.response_schema).toEqual(schema)
})
```

Créer `src/lib/suivi/relance.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { buildPromptRelance, genererRelanceCore } from './relance'

test('buildPromptRelance contient employeur, nom et consigne de relance courte', () => {
  const p = buildPromptRelance({ titre: 'Diététicien', entreprise: 'Clinique', ville: 'Nantes' }, { nom: 'Jean Dupont' }, 'Bonjour, ma candidature...')
  expect(p).toContain('Clinique')
  expect(p).toContain('Jean Dupont')
  expect(p.toLowerCase()).toContain('relance')
  expect(p).toContain('objet')
})

test('genererRelanceCore appelle Gemini et enregistre le résultat', async () => {
  const updates: any[] = []
  const candSingle = vi.fn().mockResolvedValue({
    data: { email_corps: 'email initial', offres: { titre: 'Diét', entreprise: 'C', ville: 'Nantes' } }, error: null,
  })
  const client: any = {
    from: vi.fn((table: string) => {
      if (table === 'candidatures') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: candSingle }) }) }),
          update: (p: any) => { updates.push(p); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) } },
        }
      }
      if (table === 'profils') return { select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { nom: 'Jean' }, error: null }) }) }) }
      throw new Error('table inattendue ' + table)
    }),
  }
  const appelerImpl = vi.fn().mockResolvedValue({ objet: 'Relance', corps: 'Bonjour...' })

  const out = await genererRelanceCore({ client, userId: 'u1', offreId: 'o1', appelerImpl })

  expect(appelerImpl).toHaveBeenCalledTimes(1)
  expect(out).toEqual({ objet: 'Relance', corps: 'Bonjour...' })
  expect(updates.some((p) => p.relance_objet === 'Relance' && p.relance_corps === 'Bonjour...')).toBe(true)
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/candidature/gemini.test.ts src/lib/suivi/relance.test.ts
```
Attendu : FAIL (`appelerGeminiJson`, `./relance` absents).

- [ ] **Step 3: Ajouter `appelerGeminiJson` à gemini.ts**

Dans `src/lib/candidature/gemini.ts`, ajouter (réutilise `ENDPOINT`/`requireEnv` déjà présents) :

```ts
// Appel Gemini générique texte -> JSON structuré (sans PDF), pour des usages
// hors candidature complète (ex. mail de relance).
export async function appelerGeminiJson<T>(
  prompt: string,
  schema: object,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<T> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { response_mime_type: 'application/json', response_schema: schema },
  }
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': requireEnv('GEMINI_API_KEY') },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Appel Gemini échoué : HTTP ${res.status} ${detail}`.trim())
  }
  const json = await res.json()
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Appel Gemini : réponse vide')
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Réponse Gemini malformée')
  }
}
```

- [ ] **Step 4: Implémenter `relance.ts`**

Créer `src/lib/suivi/relance.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { appelerGeminiJson } from '@/lib/candidature/gemini'
import { getProfil } from '@/lib/profil'
import { setRelanceEmail } from './lecture'

export type RelanceContenu = { objet: string; corps: string }

export const RELANCE_SCHEMA = {
  type: 'OBJECT',
  properties: { objet: { type: 'STRING' }, corps: { type: 'STRING' } },
  required: ['objet', 'corps'],
}

export function buildPromptRelance(
  offre: { titre: string; entreprise: string | null; ville: string | null },
  profil: { nom: string | null },
  emailInitial: string | null,
): string {
  return [
    "Tu es un assistant de candidature. Rédige un email de RELANCE court, poli et professionnel",
    "pour une candidature déjà envoyée et restée sans réponse.",
    '',
    'OFFRE :',
    `- Intitulé : ${offre.titre}`,
    `- Employeur : ${offre.entreprise ?? 'non précisé'}`,
    `- Ville : ${offre.ville ?? 'non précisée'}`,
    '',
    `CANDIDAT : ${profil.nom ?? 'non précisé'}`,
    '',
    emailInitial ? `EMAIL INITIAL ENVOYÉ :\n${emailInitial}` : 'Aucun email initial disponible.',
    '',
    'CONSIGNES :',
    "- Rappelle brièvement la candidature et l'intérêt pour le poste, sans insister.",
    "- Ton courtois, positif, concis (5 phrases maximum).",
    "- En français. N'invente aucun fait.",
    '- Réponds STRICTEMENT en JSON : { objet, corps }.',
  ].join('\n')
}

export async function genererRelanceCore(deps: {
  client: SupabaseClient
  userId: string
  offreId: string
  appelerImpl?: typeof appelerGeminiJson
}): Promise<RelanceContenu> {
  const { client, userId, offreId } = deps
  const appeler = deps.appelerImpl ?? appelerGeminiJson

  const { data: cand, error } = await client
    .from('candidatures')
    .select('email_corps, offres:offre_id (titre, entreprise, ville)')
    .eq('user_id', userId)
    .eq('offre_id', offreId)
    .single()
  if (error || !cand) throw new Error('Candidature introuvable')
  const offre = (Array.isArray(cand.offres) ? cand.offres[0] : cand.offres) as { titre: string; entreprise: string | null; ville: string | null }
  const profil = await getProfil(client, userId)

  const prompt = buildPromptRelance(offre, { nom: profil?.nom ?? null }, cand.email_corps ?? null)
  const contenu = await appeler(prompt, RELANCE_SCHEMA) as RelanceContenu
  await setRelanceEmail(client, userId, offreId, contenu)
  return contenu
}
```

- [ ] **Step 5: Étendre `lecture.ts` (`setRelanceEmail` + `getSuivi`)**

Dans `src/lib/suivi/lecture.ts` :

1. Élargir le type et la lecture :

```ts
export type CandidatureSuivi = {
  offre: OffreRow
  statut: string
  postulee_le: string | null
  relance_le: string | null
  notes: string | null
  relance_objet: string | null
  relance_corps: string | null
}
```

Dans `getSuivi`, changer le `.select(...)` et le `.map(...)` :

```ts
    .select(`statut, postulee_le, relance_le, notes, relance_objet, relance_corps, offres:offre_id (${OFFRE_COLUMNS})`)
```

```ts
      return {
        offre, statut: r.statut, postulee_le: r.postulee_le ?? null, relance_le: r.relance_le ?? null,
        notes: r.notes ?? null, relance_objet: r.relance_objet ?? null, relance_corps: r.relance_corps ?? null,
      }
```

2. Ajouter `setRelanceEmail` (réutilise `majCandidature`) :

```ts
export async function setRelanceEmail(
  client: SupabaseClient,
  userId: string,
  offreId: string,
  patch: { objet: string; corps: string },
): Promise<void> {
  await majCandidature(client, userId, offreId, { relance_objet: patch.objet, relance_corps: patch.corps })
}
```

- [ ] **Step 6: Ajouter les Server Actions relance**

Dans `src/lib/suivi/actions.ts`, ajouter :

```ts
import { genererRelanceCore, type RelanceContenu } from './relance'
import { setRelanceEmail } from './lecture'
```

```ts
export async function genererRelance(offreId: string): Promise<RelanceContenu> {
  const { supabase, userId } = await userOuErreur()
  const contenu = await genererRelanceCore({ client: supabase, userId, offreId })
  revalidatePath('/suivi')
  return contenu
}

export async function enregistrerRelance(offreId: string, patch: { objet: string; corps: string }): Promise<void> {
  const { supabase, userId } = await userOuErreur()
  await setRelanceEmail(supabase, userId, offreId, patch)
  revalidatePath('/suivi')
}
```

- [ ] **Step 7: Lancer les tests + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/candidature/gemini.test.ts src/lib/suivi/relance.test.ts && npx tsc --noEmit && npx vitest run
```
Attendu : PASS partout, tsc propre.

- [ ] **Step 8: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi2): mail de relance IA (appelerGeminiJson + genererRelance + enregistrement)"
```

---

### Task 5: PostulerToggle (page offre + éditeur candidature)

**Files:**
- Create: `src/components/postuler-toggle.tsx`
- Modify: `src/app/offre/[id]/page.tsx`
- Modify: `src/components/offre-detail.tsx`
- Modify: `src/components/candidature-editor.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/postuler-toggle.test.tsx`

**Interfaces:**
- Consumes: `marquerPostulee`, `retirerDuSuivi` de `@/lib/suivi/actions` ; `getCandidature` de `@/lib/candidature/lecture` ; `Link` de `next/link`.
- Produces: `PostulerToggle({ offreId, statutInitial }: { offreId: string; statutInitial: string })`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/components/postuler-toggle.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import PostulerToggle from './postuler-toggle'

const marquerPostulee = vi.fn().mockResolvedValue(undefined)
const retirerDuSuivi = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/suivi/actions', () => ({
  marquerPostulee: (...a: unknown[]) => marquerPostulee(...a),
  retirerDuSuivi: (...a: unknown[]) => retirerDuSuivi(...a),
}))

test('statut brouillon : bouton « J\'ai postulé », clic appelle marquerPostulee', async () => {
  const user = userEvent.setup()
  render(<PostulerToggle offreId="o1" statutInitial="brouillon" />)
  const btn = screen.getByRole('button', { name: /j'ai postulé/i })
  await user.click(btn)
  expect(marquerPostulee).toHaveBeenCalledWith('o1')
})

test('statut postulee : état « Postulé », lien vers le suivi, pas de bouton « J\'ai postulé »', () => {
  render(<PostulerToggle offreId="o1" statutInitial="postulee" />)
  expect(screen.getByText(/postulé/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /suivi/i })).toHaveAttribute('href', '/suivi')
  expect(screen.queryByRole('button', { name: /j'ai postulé/i })).toBeNull()
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/postuler-toggle.test.tsx
```
Attendu : FAIL (composant absent).

- [ ] **Step 3: Implémenter `PostulerToggle`**

Créer `src/components/postuler-toggle.tsx` :

```tsx
'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { marquerPostulee, retirerDuSuivi } from '@/lib/suivi/actions'

export default function PostulerToggle({ offreId, statutInitial }: { offreId: string; statutInitial: string }) {
  const [postule, setPostule] = useState(statutInitial !== 'brouillon')
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function marquer() {
    setErreur(null); setPostule(true)
    startTransition(async () => {
      try { await marquerPostulee(offreId) } catch { setPostule(false); setErreur('Échec, réessaie.') }
    })
  }

  function annuler() {
    setErreur(null); setPostule(false)
    startTransition(async () => {
      try { await retirerDuSuivi(offreId) } catch { setPostule(true); setErreur('Échec, réessaie.') }
    })
  }

  if (!postule) {
    return (
      <div className="postuler-toggle">
        <button type="button" className="btn-apply" onClick={marquer} disabled={isPending}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          J&apos;ai postulé
        </button>
        {erreur && <span className="cand-err">{erreur}</span>}
      </div>
    )
  }

  return (
    <div className="postuler-toggle done">
      <span className="postuler-badge">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        Postulé
      </span>
      <Link href="/suivi" className="postuler-link">Voir le suivi</Link>
      <button type="button" className="postuler-annuler" onClick={annuler} disabled={isPending}>Annuler</button>
      {erreur && <span className="cand-err">{erreur}</span>}
    </div>
  )
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/postuler-toggle.test.tsx
```
Attendu : PASS.

- [ ] **Step 5: Charger le statut sur la page offre**

Dans `src/app/offre/[id]/page.tsx`, charger la candidature et passer son statut à `OffreDetail`. Modifier ainsi :

```tsx
import { getFavoriIds } from '@/lib/favoris/lecture'
import { getCandidature } from '@/lib/candidature/lecture'
```

```tsx
  const [favoriIds, candidature] = await Promise.all([
    getFavoriIds(supabase, user.id),
    getCandidature(supabase, user.id, id),
  ])
  return <OffreDetail offre={offre as OffreRow} likedInitial={favoriIds.includes(id)} statutSuivi={candidature?.statut ?? 'brouillon'} />
```

(Adapter selon le code existant : conserver l'appel `getFavoriIds` déjà présent, ajouter `getCandidature` en parallèle.)

- [ ] **Step 6: Afficher `PostulerToggle` dans `offre-detail.tsx`**

Dans `src/components/offre-detail.tsx` :

1. Ajouter l'import : `import PostulerToggle from './postuler-toggle'`.
2. Ajouter `statutSuivi` aux props :

```tsx
export default function OffreDetail({ offre, likedInitial, statutSuivi }: { offre: OffreRow; likedInitial: boolean; statutSuivi: string }) {
```

3. Dans l'aside, juste après le bouton `Postuler`/lien indisponible et avant le lien `.btn-future` « Candidater avec lettre IA », insérer :

```tsx
              <PostulerToggle offreId={offre.id} statutInitial={statutSuivi} />
```

- [ ] **Step 7: Remplacer l'encart bespoke de l'éditeur par `PostulerToggle`**

Dans `src/components/candidature-editor.tsx` :

1. Retirer l'import `{ marquerPostulee, retirerDuSuivi }` et les fonctions `jaiPostule`/`retirerSuivi` et l'état `statutSuivi` NE sont plus nécessaires pour l'encart, MAIS `statutSuivi` sert d'état initial. Remplacer le bloc `.cand-suivi` (dans `.cand-postuler`) par :

```tsx
        <div className="cand-suivi">
          <PostulerToggle offreId={offre.id} statutInitial={statutSuivi} />
        </div>
```

2. Ajouter l'import : `import PostulerToggle from './postuler-toggle'`.
3. Conserver l'état `statutSuivi` (initialisé depuis `candidatureInitiale?.statut`) et sa synchro dans `appliquer`. Supprimer les fonctions `jaiPostule` et `retirerSuivi` (désormais dans `PostulerToggle`) et l'import des actions suivi devenu inutile. Vérifier que la suite de tests de l'éditoralerte toujours (les 2 tests « J'ai postulé »/« dans ton suivi » de l'éditeur sont désormais couverts par `postuler-toggle.test.tsx` : retirer ces 2 tests de `candidature-editor.test.tsx` s'ils échouent car le markup a changé, en gardant les 3 tests d'origine verts).

- [ ] **Step 8: Ajouter les styles**

Dans `src/app/globals.css`, ajouter :

```css
/* Bouton « J'ai postulé » (page offre + candidature) */
.postuler-toggle { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.postuler-toggle .btn-apply { display: inline-flex; align-items: center; gap: 8px; }
.postuler-toggle.done { justify-content: flex-start; }
.postuler-badge { display: inline-flex; align-items: center; gap: 7px; font-weight: 700; color: var(--accent-dark); }
.postuler-link { font-size: .86rem; font-weight: 600; color: var(--accent-dark); text-decoration: underline; }
.postuler-annuler { font-size: .8rem; color: var(--muted); background: none; border: 0; cursor: pointer; text-decoration: underline; }
.postuler-annuler:hover { color: #e2565b; }
```

- [ ] **Step 9: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 10: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi2): PostulerToggle réutilisable (page offre + éditeur candidature)"
```

---

### Task 6: Refonte dashboard (relance, mail de relance, ajout manuel, suppression)

**Files:**
- Create: `src/components/ajout-candidature.tsx`
- Modify: `src/components/suivi-carte.tsx`
- Modify: `src/components/suivi-liste.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/ajout-candidature.test.tsx`, `src/components/suivi-carte.test.tsx` (ajout), `src/components/suivi-liste.test.tsx` (ajout)

**Interfaces:**
- Consumes: `ajouterCandidatureManuelle`, `supprimerCandidature`, `genererRelance`, `enregistrerRelance`, `changerStatut`, `enregistrerSuivi` de `@/lib/suivi/actions` ; `joursDepuis`, `estARelancer` de `@/lib/suivi/dates` ; `CandidatureSuivi` (élargi) de `@/lib/suivi/lecture`.
- Produces: `AjoutCandidature()` (formulaire manuel). `SuiviCarte` refondue. `SuiviListe` avec bandeau « à relancer » + bouton d'ajout.

- [ ] **Step 1: Écrire le test de l'ajout manuel (échoue)**

Créer `src/components/ajout-candidature.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import AjoutCandidature from './ajout-candidature'

const ajouterCandidatureManuelle = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/suivi/actions', () => ({
  ajouterCandidatureManuelle: (...a: unknown[]) => ajouterCandidatureManuelle(...a),
}))

test('ouvre le formulaire et soumet une candidature manuelle', async () => {
  const user = userEvent.setup()
  render(<AjoutCandidature />)
  await user.click(screen.getByRole('button', { name: /ajouter une candidature/i }))
  await user.type(screen.getByLabelText(/intitulé/i), 'Diététicien')
  await user.type(screen.getByLabelText(/entreprise/i), 'Clinique')
  await user.click(screen.getByRole('button', { name: /^ajouter$/i }))
  expect(ajouterCandidatureManuelle).toHaveBeenCalledWith(
    expect.objectContaining({ titre: 'Diététicien', entreprise: 'Clinique' }),
  )
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/ajout-candidature.test.tsx
```
Attendu : FAIL (composant absent).

- [ ] **Step 3: Implémenter `AjoutCandidature`**

Créer `src/components/ajout-candidature.tsx` :

```tsx
'use client'
import { useState, useTransition } from 'react'
import { ajouterCandidatureManuelle } from '@/lib/suivi/actions'

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AjoutCandidature() {
  const [ouvert, setOuvert] = useState(false)
  const [titre, setTitre] = useState('')
  const [entreprise, setEntreprise] = useState('')
  const [ville, setVille] = useState('')
  const [url, setUrl] = useState('')
  const [dateIso, setDateIso] = useState(aujourdhui())
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) { setErreur('L\'intitulé est requis.'); return }
    setErreur(null)
    startTransition(async () => {
      try {
        await ajouterCandidatureManuelle({ titre: titre.trim(), entreprise: entreprise.trim(), ville: ville.trim(), url: url.trim(), dateIso })
        setOuvert(false); setTitre(''); setEntreprise(''); setVille(''); setUrl(''); setDateIso(aujourdhui())
      } catch {
        setErreur('Échec de l\'ajout, réessaie.')
      }
    })
  }

  if (!ouvert) {
    return (
      <button type="button" className="btn-primary ajout-ouvrir" onClick={() => setOuvert(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Ajouter une candidature
      </button>
    )
  }

  return (
    <form className="ajout-form" onSubmit={soumettre}>
      <h3>Ajouter une candidature</h3>
      <div className="ajout-grid">
        <label>Intitulé<input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Diététicien" /></label>
        <label>Entreprise<input value={entreprise} onChange={(e) => setEntreprise(e.target.value)} placeholder="Nom de l'employeur" /></label>
        <label>Ville<input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Nantes" /></label>
        <label>Lien<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></label>
        <label>Date de candidature<input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} /></label>
      </div>
      {erreur && <p className="cand-err">{erreur}</p>}
      <div className="ajout-actions">
        <button type="submit" className="btn-primary" disabled={isPending}>Ajouter</button>
        <button type="button" className="btn-ghost" onClick={() => setOuvert(false)}>Annuler</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/ajout-candidature.test.tsx
```
Attendu : PASS.

- [ ] **Step 5: Refondre `SuiviCarte` (test d'abord)**

Ajouter à `src/components/suivi-carte.test.tsx` (garder les 2 tests existants ; compléter le mock des actions et ajouter des tests). Le `vi.mock('@/lib/suivi/actions', ...)` existant doit exposer aussi `genererRelance`, `enregistrerRelance`, `supprimerCandidature` :

```tsx
vi.mock('@/lib/suivi/actions', () => ({
  changerStatut: (...a: unknown[]) => changerStatut(...a),
  enregistrerSuivi: (...a: unknown[]) => enregistrerSuivi(...a),
  genererRelance: vi.fn().mockResolvedValue({ objet: 'R', corps: 'C' }),
  enregistrerRelance: vi.fn(),
  supprimerCandidature: vi.fn(),
}))
```

Ajouter les tests (l'objet `item` de base a `relance_objet: null, relance_corps: null`) :

```tsx
test('affiche « postulé il y a X jours »', () => {
  render(<SuiviCarte item={{ ...item, postulee_le: '2026-07-10' }} today="2026-07-13" />)
  expect(screen.getByText(/postulé il y a 3 jours/i)).toBeInTheDocument()
})

test('badge « à relancer » quand la date de relance est atteinte', () => {
  render(<SuiviCarte item={{ ...item, statut: 'postulee', relance_le: '2026-07-15' }} today="2026-07-20" />)
  expect(screen.getByText(/à relancer/i)).toBeInTheDocument()
})

test('bouton « Générer un mail de relance » présent pour une candidature postulée', () => {
  render(<SuiviCarte item={{ ...item, statut: 'postulee' }} today="2026-07-20" />)
  expect(screen.getByRole('button', { name: /mail de relance/i })).toBeInTheDocument()
})
```

Note : `SuiviCarte` reçoit désormais une prop `today: string` (injectée par la liste, pour des dates testables et cohérentes). Les 2 tests existants doivent passer `today="2026-07-20"` (ajouter la prop) — mettre à jour ces deux `render(...)`.

- [ ] **Step 6: Lancer, vérifier l'échec**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/suivi-carte.test.tsx
```
Attendu : FAIL (prop `today` et nouveaux éléments absents).

- [ ] **Step 7: Réécrire `SuiviCarte`**

Remplacer `src/components/suivi-carte.tsx` par :

```tsx
'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { CandidatureSuivi } from '@/lib/suivi/lecture'
import { STATUTS_SUIVI, STATUT_LABEL, type StatutSuivi } from '@/lib/suivi/statuts'
import { changerStatut, enregistrerSuivi, genererRelance, enregistrerRelance, supprimerCandidature } from '@/lib/suivi/actions'
import { joursDepuis, estARelancer } from '@/lib/suivi/dates'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function SuiviCarte({ item, today }: { item: CandidatureSuivi; today: string }) {
  const [statut, setStatut] = useState(item.statut)
  const [relance, setRelance] = useState(item.relance_le ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [relObjet, setRelObjet] = useState(item.relance_objet ?? '')
  const [relCorps, setRelCorps] = useState(item.relance_corps ?? '')
  const [relanceOuverte, setRelanceOuverte] = useState(Boolean(item.relance_corps))
  const [info, setInfo] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const o = item.offre
  const aRelancer = estARelancer(statut, relance || null, today)
  const jours = item.postulee_le ? joursDepuis(item.postulee_le, today) : null

  function onStatut(v: string) {
    setStatut(v)
    startTransition(async () => { try { await changerStatut(o.id, v) } catch { setStatut(item.statut) } })
  }
  function sauverDetails(nextNotes: string, nextRelance: string) {
    startTransition(async () => { try { await enregistrerSuivi(o.id, { notes: nextNotes || null, relance_le: nextRelance || null }) } catch { /* non bloquant */ } })
  }
  function genererMailRelance() {
    setErreur(null); setInfo(null)
    startTransition(async () => {
      try {
        const c = await genererRelance(o.id)
        setRelObjet(c.objet); setRelCorps(c.corps); setRelanceOuverte(true)
      } catch { setErreur('La génération a échoué, réessaie.') }
    })
  }
  function sauverRelance() {
    startTransition(async () => { try { await enregistrerRelance(o.id, { objet: relObjet, corps: relCorps }); setInfo('Relance enregistrée ✓') } catch { setErreur('Échec, réessaie.') } })
  }
  async function copierRelance() {
    try { await navigator.clipboard.writeText(`${relObjet}\n\n${relCorps}`); setInfo('Mail de relance copié ✓') } catch { setErreur('Copie impossible.') }
  }
  function supprimer() {
    if (!window.confirm('Supprimer cette candidature du suivi ?')) return
    startTransition(async () => { try { await supprimerCandidature(o.id) } catch { setErreur('Échec de la suppression, réessaie.') } })
  }

  const titre = o.url_postuler
    ? <a href={o.source === 'manuelle' ? o.url_postuler : `/offre/${o.id}`} className="suivi-carte-titre" {...(o.source === 'manuelle' ? { target: '_blank', rel: 'noopener' } : {})}>{o.titre}</a>
    : o.source === 'manuelle'
      ? <span className="suivi-carte-titre">{o.titre}</span>
      : <Link href={`/offre/${o.id}`} className="suivi-carte-titre">{o.titre}</Link>

  return (
    <div className={`suivi-carte st-${statut}`}>
      <div className="suivi-carte-top">
        <div className="suivi-carte-head">
          {titre}
          <div className="suivi-carte-emp"><b>{o.entreprise ?? 'Employeur non précisé'}</b>{o.ville ? ` · ${o.ville}` : ''}</div>
          <div className="suivi-carte-meta">
            {jours !== null && <span>Postulé il y a {jours} jour{jours > 1 ? 's' : ''}</span>}
            {aRelancer && <span className="suivi-badge-relance">À relancer</span>}
          </div>
        </div>
        <div className="suivi-carte-actions">
          <label className="suivi-carte-statut">
            <span className="sr-label">Statut</span>
            <select value={statut} onChange={(e) => onStatut(e.target.value)}>
              {STATUTS_SUIVI.map((s: StatutSuivi) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
            </select>
          </label>
          <button type="button" className="suivi-supprimer" onClick={supprimer} aria-label="Supprimer" disabled={isPending}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        </div>
      </div>

      <div className="suivi-carte-details">
        <label className="suivi-champ">
          <span>Relance prévue</span>
          <input type="date" value={relance} onChange={(e) => setRelance(e.target.value)} onBlur={(e) => sauverDetails(notes, e.target.value)} />
        </label>
        <label className="suivi-champ grow">
          <span>Notes</span>
          <textarea rows={2} value={notes} placeholder="Contact, ressenti, prochaine étape…" onChange={(e) => setNotes(e.target.value)} onBlur={(e) => sauverDetails(e.target.value, relance)} />
        </label>
      </div>

      <div className="suivi-relance">
        <button type="button" className="btn-ghost" onClick={genererMailRelance} disabled={isPending}>
          {isPending ? '…' : (relCorps ? 'Regénérer le mail de relance' : 'Générer un mail de relance')}
        </button>
        {relanceOuverte && (
          <div className="suivi-relance-bloc">
            <label>Objet<input value={relObjet} onChange={(e) => setRelObjet(e.target.value)} /></label>
            <label>Message<textarea rows={5} value={relCorps} onChange={(e) => setRelCorps(e.target.value)} /></label>
            <div className="suivi-relance-actions">
              <button type="button" className="btn-ghost" onClick={sauverRelance} disabled={isPending}>Enregistrer</button>
              <button type="button" className="btn-ghost" onClick={copierRelance}>Copier</button>
              <button type="button" className="btn-ghost" onClick={() => onStatut('relancee')} disabled={isPending}>J&apos;ai relancé</button>
            </div>
          </div>
        )}
        {info && <span className="cand-ok">{info}</span>}
        {erreur && <span className="cand-err">{erreur}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Lancer, vérifier le succès**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/suivi-carte.test.tsx
```
Attendu : PASS.

- [ ] **Step 9: Mettre à jour `SuiviListe` (bandeau à relancer + ajout + `today`)**

Dans `src/components/suivi-liste.tsx` :

1. Importer : `import AjoutCandidature from './ajout-candidature'` et `import { estARelancer } from '@/lib/suivi/dates'`.
2. Calculer `today` une fois et le compteur « à relancer », passer `today` à chaque `SuiviCarte` :

```tsx
export default function SuiviListe({ items }: { items: CandidatureSuivi[] }) {
  const today = new Date().toISOString().slice(0, 10)
  // ... branche "état vide" inchangée, mais ajouter le bouton d'ajout au-dessus (voir ci-dessous)
```

Dans la branche « état vide », ajouter `<AjoutCandidature />` sous le lien de recherche. Dans la branche principale, avant les sections, ajouter le bouton d'ajout et un bandeau si des candidatures sont à relancer :

```tsx
  const aRelancer = items.filter((i) => estARelancer(i.statut, i.relance_le, today)).length
  // ... dans le rendu, après <div className="suivi-stats">...</div> :
  //   <div className="suivi-barre">
  //     {aRelancer > 0 && <div className="suivi-relance-bandeau">{aRelancer} candidature{aRelancer > 1 ? 's' : ''} à relancer</div>}
  //     <AjoutCandidature />
  //   </div>
```

Et remplacer `<SuiviCarte key={i.offre.id} item={i} />` par `<SuiviCarte key={i.offre.id} item={i} today={today} />`.

- [ ] **Step 10: Mettre à jour le test de `SuiviListe`**

Dans `src/components/suivi-liste.test.tsx`, compléter le `vi.mock('@/lib/suivi/actions', ...)` pour inclure `genererRelance`, `enregistrerRelance`, `supprimerCandidature`, `ajouterCandidatureManuelle` (les cartes et l'ajout les importent). Les `item(...)` factices ont déjà `relance_objet`/`relance_corps` : ajouter ces deux champs à `null` dans la factory. Ajouter un test :

```tsx
test('bandeau « à relancer » quand une candidature est échue', () => {
  const it = { ...item('a', 'postulee'), relance_le: '2000-01-01' }
  render(<SuiviListe items={[it]} />)
  expect(screen.getByText(/à relancer/i)).toBeInTheDocument()
})
```

(Adapter la factory `item` du fichier pour accepter/États `relance_le`, `relance_objet`, `relance_corps`.)

- [ ] **Step 11: Ajouter les styles**

Dans `src/app/globals.css`, ajouter :

```css
/* Barre d'actions du dashboard + bandeau à relancer */
.suivi-barre { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.suivi-relance-bandeau {
  display: inline-flex; align-items: center; gap: 8px; font-size: .88rem; font-weight: 700; color: #b06a12;
  background: #fdf3e2; border: 1px solid #f2dcb8; border-radius: 12px; padding: 9px 15px;
}
.ajout-ouvrir { display: inline-flex; align-items: center; gap: 8px; }
.ajout-form { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; box-shadow: var(--shadow-sm); }
.ajout-form h3 { font-size: 1rem; font-weight: 700; margin-bottom: 14px; }
.ajout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ajout-grid label { display: flex; flex-direction: column; gap: 5px; font-size: .78rem; font-weight: 600; color: var(--muted); }
.ajout-grid input { font-family: inherit; font-size: .9rem; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; outline: none; }
.ajout-grid input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.ajout-actions { display: flex; gap: 10px; margin-top: 14px; }
@media (max-width: 560px) { .ajout-grid { grid-template-columns: 1fr; } }

/* Carte suivi : métas, badge à relancer, suppression, bloc relance */
.suivi-carte-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: .78rem; color: var(--muted); margin-top: 5px; }
.suivi-badge-relance { font-weight: 700; color: #b06a12; background: #fdf3e2; border-radius: 999px; padding: 2px 9px; }
.suivi-carte-actions { display: flex; align-items: flex-start; gap: 8px; }
.suivi-supprimer { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--line); background: #fff; color: var(--muted); cursor: pointer; }
.suivi-supprimer:hover { color: #e2565b; border-color: #f0c9cb; }
.suivi-relance { margin-top: 13px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.suivi-relance-bloc { width: 100%; display: flex; flex-direction: column; gap: 8px; background: #fbfbfa; border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
.suivi-relance-bloc label { display: flex; flex-direction: column; gap: 5px; font-size: .76rem; font-weight: 600; color: var(--muted); }
.suivi-relance-bloc input, .suivi-relance-bloc textarea { font-family: inherit; font-size: .86rem; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px; outline: none; resize: vertical; }
.suivi-relance-bloc input:focus, .suivi-relance-bloc textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.suivi-relance-actions { display: flex; gap: 8px; flex-wrap: wrap; }
```

- [ ] **Step 12: Vérifier types + suite complète + build**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run && npx next build
```
Attendu : tsc propre, suite verte, build OK.

- [ ] **Step 13: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(suivi2): refonte dashboard (jours, relance + mail IA, ajout manuel, suppression)"
```

---

## Notes de fin de plan (hors tâches)

- **Migration à appliquer sur Supabase distant après merge** : `0008_suivi2.sql` (colonnes `relance_objet`/`relance_corps` + policies `offres` manuelle).
- **Dépendance inter-briques** : `setPostulee` change de signature (ajout `relanceIso`) ; tous ses appelants sont mis à jour dans ce plan (`marquerPostulee`).
- **RLS** : les policies `offres_insert_manuelle` / `offres_delete_manuelle` sont volontairement limitées à `source='manuelle'` ; les offres collectées restent gérées par le service role.
- **Nettoyage** : une offre manuelle est supprimée avec sa candidature ; une offre France Travail n'est jamais supprimée.
