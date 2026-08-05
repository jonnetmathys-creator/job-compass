# Notif "depuis la dernière visite" + purge · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** la cloche affiche les offres non-vues sur 30 jours (au lieu de 24h), et une purge supprime les vieilles offres sans valeur en fin de cron.

**Architecture :** on modifie la lecture de `boite.ts` (fenêtre + filtre non-vu), on ajoute un module `purge.ts` (fonction pure + enveloppe Supabase), et on branche la purge dans `/api/refresh`. Aucune nouvelle table.

**Tech Stack :** TypeScript, Next.js 16, Supabase, Vitest.

## Global Constraints

- Jamais de tiret cadratin dans le code, les commentaires ou la doc. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- Logique métier en fonctions pures testables ; appels Supabase en enveloppes fines.
- `getServiceClient` réservé au cron, jamais exposé au navigateur.
- Messages de commit terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Ne rien pousser sur GitHub : commits locaux uniquement.

## File Structure

- `src/lib/alertes/boite.ts` (modifié) : fenêtre 30 jours + filtre non-vu.
- `src/lib/alertes/boite.test.ts` (modifié) : mocks alignés sur la nouvelle chaîne.
- `src/lib/alertes/purge.ts` (créé) : `offresAPurger` (pure) + `purgerVieillesOffres` (Supabase).
- `src/lib/alertes/purge.test.ts` (créé) : tests de la purge.
- `src/app/api/refresh/route.ts` (modifié) : appel de la purge en fin de cron.

---

### Task 1: Cloche · non-vu sur 30 jours

**Files:**
- Modify: `src/lib/alertes/boite.ts`
- Test: `src/lib/alertes/boite.test.ts`

**Interfaces:**
- Produces : `FENETRE_NOTIF_JOURS = 30` exporté ; `getBoite` et `compterNonVues` filtrent le non-vu sur 30 jours.

- [ ] **Step 1: Mettre à jour les tests (échouent d'abord)**

Dans `src/lib/alertes/boite.test.ts`, remplacer le test `getBoite` et le test `compterNonVues` par ces versions (la chaîne de `getBoite` intercale `is('vue_le', null)` avant `gt`) :

```ts
test('getBoite ne renvoie que le non-vu sur la fenêtre, joint aux offres, trié', async () => {
  const rows = [
    { created_at: '2026-07-29T10:00:00Z', vue_le: null, offres: { id: 'o2', titre: 'B' } },
    { created_at: '2026-07-29T08:00:00Z', vue_le: null, offres: { id: 'o1', titre: 'A' } },
  ]
  const gt = vi.fn().mockResolvedValue({ data: rows, error: null })
  const is = vi.fn(() => ({ gt }))
  const eq = vi.fn(() => ({ is }))
  const select = vi.fn(() => ({ eq }))
  const client = { from: vi.fn(() => ({ select })) } as any

  const out = await getBoite(client, 'u1')

  expect(client.from).toHaveBeenCalledWith('nouvelles_offres')
  expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  expect(is).toHaveBeenCalledWith('vue_le', null)
  expect(gt).toHaveBeenCalledWith('created_at', expect.any(String))
  expect(out.map((n) => n.offre.id)).toEqual(['o2', 'o1'])
})

test('compterNonVues filtre vue_le null et la fenêtre', async () => {
  const gt = vi.fn().mockResolvedValue({ data: [{ offre_id: 'a' }, { offre_id: 'b' }], error: null })
  const is = vi.fn(() => ({ gt }))
  const eq = vi.fn(() => ({ is }))
  const select = vi.fn(() => ({ eq }))
  const client = { from: vi.fn(() => ({ select })) } as any

  const n = await compterNonVues(client, 'u1')
  expect(is).toHaveBeenCalledWith('vue_le', null)
  expect(n).toBe(2)
})
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npx vitest run src/lib/alertes/boite.test.ts`
Expected: FAIL (`getBoite` n'appelle pas encore `is('vue_le', null)`).

- [ ] **Step 3: Modifier `boite.ts`**

Remplacer le helper `cutoff24h` par la constante et le nouveau helper (en haut du fichier, après les imports) :

```ts
export const FENETRE_NOTIF_JOURS = 30

function cutoffFenetre(): string {
  return new Date(Date.now() - FENETRE_NOTIF_JOURS * 24 * 60 * 60 * 1000).toISOString()
}
```

Dans `getBoite`, ajouter le filtre non-vu et utiliser la nouvelle fenêtre. La requête devient :

```ts
  const { data, error } = await client
    .from('nouvelles_offres')
    .select(`created_at, vue_le, offres:offre_id (${OFFRE_COLUMNS})`)
    .eq('user_id', userId)
    .is('vue_le', null)
    .gt('created_at', cutoffFenetre())
```

Dans `compterNonVues`, remplacer `cutoff24h()` par `cutoffFenetre()` (le reste de la fonction est inchangé).

Supprimer la fonction `cutoff24h` devenue inutile.

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `npx vitest run src/lib/alertes/boite.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/alertes/boite.ts src/lib/alertes/boite.test.ts
git commit -m "feat(cloche): affiche le non-vu sur 30 jours au lieu des 24 dernières heures

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Module de purge

**Files:**
- Create: `src/lib/alertes/purge.ts`
- Test: `src/lib/alertes/purge.test.ts`

**Interfaces:**
- Consumes : `SupabaseClient` depuis `@supabase/supabase-js`.
- Produces : `offresAPurger(input) => string[]` (pure) ; `purgerVieillesOffres(client, jours?) => Promise<number>`.

- [ ] **Step 1: Écrire les tests (échouent d'abord)**

Créer `src/lib/alertes/purge.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { offresAPurger, purgerVieillesOffres } from './purge'

const CUTOFF = '2026-07-06T00:00:00Z' // maintenant - 30 j

test('offresAPurger ne garde que les vieilles offres orphelines', () => {
  const offres = [
    { id: 'vieille-orpheline', date_collecte: '2026-06-01T00:00:00Z', created_by: null },
    { id: 'vieille-protegee', date_collecte: '2026-06-01T00:00:00Z', created_by: null },
    { id: 'vieille-manuelle', date_collecte: '2026-06-01T00:00:00Z', created_by: 'u1' },
    { id: 'recente', date_collecte: '2026-08-01T00:00:00Z', created_by: null },
    { id: 'sans-date', date_collecte: null, created_by: null },
  ]
  const ids = offresAPurger({ offres, protegees: new Set(['vieille-protegee']), cutoffISO: CUTOFF })
  expect(ids).toEqual(['vieille-orpheline'])
})

test('purgerVieillesOffres agrège les protégées et supprime les seuls ids attendus', async () => {
  // offres candidates renvoyées par la lecture initiale
  const lt = vi.fn().mockResolvedValue({
    data: [
      { id: 'a', date_collecte: '2026-06-01T00:00:00Z', created_by: null },
      { id: 'b', date_collecte: '2026-06-01T00:00:00Z', created_by: null }, // protégée (favori)
      { id: 'c', date_collecte: '2026-06-01T00:00:00Z', created_by: null }, // protégée (rappel)
    ],
    error: null,
  })
  const protegeeSelect = (rows: any[]) => vi.fn().mockResolvedValue({ data: rows, error: null })
  const deleteIn = vi.fn().mockResolvedValue({ error: null })

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'offres') {
        return {
          select: vi.fn(() => ({ lt })),
          delete: vi.fn(() => ({ in: deleteIn })),
        }
      }
      if (table === 'favoris') return { select: protegeeSelect([{ offre_id: 'b' }]) }
      if (table === 'candidatures') return { select: protegeeSelect([]) }
      if (table === 'rappels') return { select: protegeeSelect([{ offre_id: 'c' }]) }
      throw new Error('table inattendue: ' + table)
    }),
  } as any

  const n = await purgerVieillesOffres(client, 30)

  expect(deleteIn).toHaveBeenCalledWith('id', ['a']) // b et c protégées
  expect(n).toBe(1)
})
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npx vitest run src/lib/alertes/purge.test.ts`
Expected: FAIL (`purge.ts` n'existe pas).

- [ ] **Step 3: Écrire `purge.ts`**

Créer `src/lib/alertes/purge.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

const JOURS_RETENTION = 30

type OffreCandidate = { id: string; date_collecte: string | null; created_by: string | null }

export function offresAPurger(input: {
  offres: OffreCandidate[]
  protegees: Set<string>
  cutoffISO: string
}): string[] {
  return input.offres
    .filter((o) =>
      o.date_collecte != null &&
      o.date_collecte < input.cutoffISO &&
      o.created_by == null &&
      !input.protegees.has(o.id))
    .map((o) => o.id)
}

async function idsProteges(client: SupabaseClient): Promise<Set<string>> {
  const tables = ['favoris', 'candidatures', 'rappels']
  const listes = await Promise.all(
    tables.map((t) => client.from(t).select('offre_id')),
  )
  const set = new Set<string>()
  for (const { data } of listes) {
    for (const row of (data ?? []) as { offre_id: string }[]) set.add(row.offre_id)
  }
  return set
}

export async function purgerVieillesOffres(client: SupabaseClient, jours = JOURS_RETENTION): Promise<number> {
  const cutoffISO = new Date(Date.now() - jours * 24 * 60 * 60 * 1000).toISOString()

  const { data: offres, error } = await client
    .from('offres')
    .select('id, date_collecte, created_by')
    .lt('date_collecte', cutoffISO)
  if (error) throw error

  const protegees = await idsProteges(client)
  const ids = offresAPurger({ offres: (offres ?? []) as OffreCandidate[], protegees, cutoffISO })
  if (ids.length === 0) return 0

  const { error: errDel } = await client.from('offres').delete().in('id', ids)
  if (errDel) throw errDel
  return ids.length
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `npx vitest run src/lib/alertes/purge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/alertes/purge.ts src/lib/alertes/purge.test.ts
git commit -m "feat(purge): supprime les vieilles offres sauf likées/candidatures/rappels/manuelles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Branchement de la purge dans le cron

**Files:**
- Modify: `src/app/api/refresh/route.ts`

**Interfaces:**
- Consumes : `purgerVieillesOffres` depuis `@/lib/alertes/purge` (testée en Task 2).
- Produces : la réponse de `/api/refresh` inclut `purgees: number`.

Note : `route.test.ts` ne teste que la fonction pure `autorise` ; `traiter` appelle `getServiceClient` en dur (non injectable). La logique de purge est déjà couverte par `purge.test.ts`. Ce branchement de 3 lignes est vérifié par la suite complète et le build, sans test d'intégration fragile · cohérent avec le style du fichier.

- [ ] **Step 1: Brancher la purge dans `route.ts`**

Ajouter l'import en haut :

```ts
import { purgerVieillesOffres } from '@/lib/alertes/purge'
```

Dans la fonction `traiter`, après la boucle `for (const r of recherches)`, avant le `return`, ajouter :

```ts
  let purgees = 0
  try { purgees = await purgerVieillesOffres(client) }
  catch (e) { console.error('[refresh] purge en échec :', e) }
```

Et compléter le retour :

```ts
  return { recherches: recherches.length, nouvelles, emails, purgees }
```

- [ ] **Step 2: Vérifier la suite complète et le build**

Run: `npx vitest run src/lib/alertes/ src/app/api/refresh/ && npx next build`
Expected: tous les tests passent (dont `route.test.ts` inchangé et `purge.test.ts`), build réussi.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/refresh/route.ts
git commit -m "feat(cron): purge des vieilles offres en fin de rafraîchissement

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Note hors code

- La purge tourne à la fréquence du cron `/api/refresh` (cron-job.org). Aucune migration : les colonnes `date_collecte` et `created_by` existent déjà (migrations 0001 et 0008).
