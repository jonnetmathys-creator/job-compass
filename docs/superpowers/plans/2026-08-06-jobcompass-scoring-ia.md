# Scoring IA des offres (3a) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** noter chaque offre 0-100 selon le CV de l'utilisateur (Gemini par lots, en arrière-plan) et l'afficher sur chaque carte (badge %, couleur rouge→vert, aura si ≥90, raison au survol, tri par pertinence).

**Architecture :** cache CV texte (`profils.cv_texte`), table `scores` par utilisateur, notation dans le cron après la collecte (dédoublonnage + lots Gemini), affichage par jointure des scores.

**Tech Stack :** TypeScript, Next.js 16, Supabase, Gemini (`gemini-flash-latest`), Vitest.

## Global Constraints

- Jamais de tiret cadratin. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- `GEMINI_API_KEY` server-side ; scoring via le client service dans le cron.
- Logique métier en fonctions pures testables ; I/O en enveloppes injectables.
- Commits terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commits locaux uniquement.

## File Structure

- `supabase/migrations/0012_scores.sql` (créé)
- `src/lib/profil.ts` (modifié : `cv_texte` + invalidation)
- `src/lib/offres/dedup-affichage.ts` (modifié : export `empreinteOffre`)
- `src/lib/candidature/gemini.ts` (modifié : `transcrirePdf`)
- `src/lib/scoring/cv.ts`, `scorer.ts`, `execution.ts`, `lecture.ts`, `palette.ts` (créés)
- `src/app/api/refresh/route.ts` (modifié : appel scoring)
- `src/app/recherche/[id]/page.tsx`, `src/components/resultats-shell.tsx`, `offre-liste.tsx`, `offre-card.tsx`, `src/app/globals.css` (modifiés : affichage)

---

### Task 1: Migration + invalidation du cache CV

**Files:**
- Create: `supabase/migrations/0012_scores.sql`
- Modify: `src/lib/profil.ts`

- [ ] **Step 1: Migration**

Créer `supabase/migrations/0012_scores.sql` :

```sql
-- Cache du CV en texte (transcrit une fois depuis le PDF) pour le scoring.
alter table public.profils add column if not exists cv_texte text;

-- Score de pertinence CV <-> offre, par utilisateur.
create table if not exists public.scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  score int not null,
  raison text,
  cree_le timestamptz not null default now(),
  primary key (user_id, offre_id)
);
alter table public.scores enable row level security;
create policy scores_self on public.scores for select using (user_id = auth.uid());
```

- [ ] **Step 2: Type Profil + invalidation à l'upload**

Dans `src/lib/profil.ts`, ajouter `cv_texte` au type :

```ts
export type Profil = {
  user_id: string
  nom: string | null
  titre_recherche: string | null
  cv_url: string | null
  cv_texte: string | null
  lettre_base: string | null
  lettre_url: string | null
}
```

Dans `uploadCv`, invalider le cache texte quand le CV change :

```ts
  await upsertProfil(client, userId, { cv_url: path, cv_texte: null })
```

- [ ] **Step 3: Vérifier le build**

Run: `npx next build`
Expected: build réussi (changement de type + SQL, aucun test cassé).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0012_scores.sql src/lib/profil.ts
git commit -m "feat(scoring): migration table scores + cache cv_texte (invalidé à l'upload)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Empreinte partagée

**Files:**
- Modify: `src/lib/offres/dedup-affichage.ts`

**Interfaces:**
- Produces : `empreinteOffre(o: Pick<OffreRow, 'titre' | 'ville' | 'entreprise'>): string` exporté, réutilisé par le scoring.

- [ ] **Step 1: Exporter l'empreinte**

Dans `src/lib/offres/dedup-affichage.ts`, renommer la fonction interne `empreinte` en `empreinteOffre`, l'exporter, et élargir son paramètre :

```ts
export function empreinteOffre(o: Pick<OffreRow, 'titre' | 'ville' | 'entreprise'>): string {
  return `${norm(o.titre)}|${norm(o.ville)}|${norm(o.entreprise)}`
}
```
Remplacer l'appel interne `empreinte(o)` par `empreinteOffre(o)`.

- [ ] **Step 2: Vérifier les tests du dédup**

Run: `npx vitest run src/lib/offres/dedup-affichage.test.ts`
Expected: PASS (comportement inchangé).

- [ ] **Step 3: Commit**

```bash
git add src/lib/offres/dedup-affichage.ts
git commit -m "refactor(offres): exporte empreinteOffre pour réutilisation par le scoring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Transcription du CV

**Files:**
- Modify: `src/lib/candidature/gemini.ts`
- Create: `src/lib/scoring/cv.ts`
- Test: `src/lib/scoring/cv.test.ts`

**Interfaces:**
- Produces : `transcrirePdf(base64, deps?) => Promise<string>` ; `assurerCvTexte(client, userId, profil, deps?) => Promise<string | null>`.

- [ ] **Step 1: Test de `assurerCvTexte` (échoue d'abord)**

Créer `src/lib/scoring/cv.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { assurerCvTexte } from './cv'

test('renvoie le cache si présent, sans extraction', async () => {
  const client = {} as any
  const t = await assurerCvTexte(client, 'u1', { cv_texte: 'déjà là', cv_url: 'u1/cv.pdf' } as any, {
    transcrire: vi.fn(), telecharger: vi.fn(),
  })
  expect(t).toBe('déjà là')
})

test('extrait et écrit le cache si absent', async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const client = { from: vi.fn(() => ({ update: () => ({ eq: upsert }) })) } as any
  const transcrire = vi.fn().mockResolvedValue('texte du cv')
  const telecharger = vi.fn().mockResolvedValue('base64pdf')
  const t = await assurerCvTexte(client, 'u1', { cv_texte: null, cv_url: 'u1/cv.pdf' } as any, { transcrire, telecharger })
  expect(telecharger).toHaveBeenCalled()
  expect(transcrire).toHaveBeenCalledWith('base64pdf')
  expect(t).toBe('texte du cv')
})

test('renvoie null sans CV', async () => {
  const t = await assurerCvTexte({} as any, 'u1', { cv_texte: null, cv_url: null } as any, {
    transcrire: vi.fn(), telecharger: vi.fn(),
  })
  expect(t).toBeNull()
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/scoring/cv.test.ts`
Expected: FAIL (module absent).

- [ ] **Step 3: `transcrirePdf` dans gemini.ts**

Ajouter à `src/lib/candidature/gemini.ts` :

```ts
// Transcrit un PDF (base64) en texte brut via Gemini. Usage : mise en cache du CV.
export async function transcrirePdf(base64: string, deps: { fetchImpl?: typeof fetch } = {}): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: 'Transcris intégralement ce document en texte brut, sans commentaire ni mise en forme.' },
        { inline_data: { mime_type: 'application/pdf', data: base64 } },
      ],
    }],
  }
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': requireEnv('GEMINI_API_KEY') },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Transcription CV échouée : HTTP ${res.status}`)
  const json = await res.json()
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Transcription CV : réponse vide')
  return text
}
```

- [ ] **Step 4: `src/lib/scoring/cv.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profil } from '@/lib/profil'
import { transcrirePdf } from '@/lib/candidature/gemini'

async function telechargerPdfBase64(client: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await client.storage.from('cv').download(path)
  if (error || !data) throw new Error('Téléchargement du CV impossible')
  const buf = Buffer.from(await data.arrayBuffer())
  return buf.toString('base64')
}

type Deps = {
  transcrire?: (base64: string) => Promise<string>
  telecharger?: (client: SupabaseClient, path: string) => Promise<string>
}

export async function assurerCvTexte(
  client: SupabaseClient, userId: string, profil: Profil, deps: Deps = {},
): Promise<string | null> {
  if (profil.cv_texte) return profil.cv_texte
  if (!profil.cv_url) return null
  const transcrire = deps.transcrire ?? ((b: string) => transcrirePdf(b))
  const telecharger = deps.telecharger ?? telechargerPdfBase64
  const base64 = await telecharger(client, profil.cv_url)
  const texte = await transcrire(base64)
  await client.from('profils').update({ cv_texte: texte }).eq('user_id', userId)
  return texte
}
```

- [ ] **Step 5: Lancer, vérifier le succès**

Run: `npx vitest run src/lib/scoring/cv.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/candidature/gemini.ts src/lib/scoring/cv.ts src/lib/scoring/cv.test.ts
git commit -m "feat(scoring): transcription du CV en texte + cache (assurerCvTexte)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Notation par lots

**Files:**
- Create: `src/lib/scoring/scorer.ts`
- Test: `src/lib/scoring/scorer.test.ts`

**Interfaces:**
- Consumes : `appelerGeminiJson` depuis `@/lib/candidature/gemini`.
- Produces : `type OffreANoter`, `type Note` ; `construirePromptScoring(cvTexte, offres) => string` ; `scorerOffres(cvTexte, offres, deps?) => Promise<Note[]>`.

- [ ] **Step 1: Tests (échouent d'abord)**

Créer `src/lib/scoring/scorer.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { construirePromptScoring, scorerOffres } from './scorer'

const offre = (ref: string) => ({ ref, titre: 'Diététicien', entreprise: 'CH', ville: 'Nantes', contrat: 'CDI', description: 'x' })

test('construirePromptScoring inclut le CV et chaque ref', () => {
  const p = construirePromptScoring('MON CV', [offre('a'), offre('b')])
  expect(p).toContain('MON CV')
  expect(p).toContain('a')
  expect(p).toContain('b')
})

test('scorerOffres découpe en lots et concatène', async () => {
  const appels: number[] = []
  const appeler = vi.fn(async (_p: string, _s: object) => {
    // renvoie une note par offre du lot ; on simule 1 note par appel via la taille
    return [{ ref: 'r' + appels.push(1), score: 80, raison: 'ok' }]
  })
  const offres = Array.from({ length: 45 }, (_, i) => offre('o' + i)) // 3 lots (20+20+5)
  const notes = await scorerOffres('cv', offres, { appeler: appeler as any })
  expect(appeler).toHaveBeenCalledTimes(3)
  expect(notes.length).toBe(3)
})

test('scorerOffres ignore un lot en échec', async () => {
  let n = 0
  const appeler = vi.fn(async () => { n++; if (n === 1) throw new Error('boom'); return [{ ref: 'x', score: 90, raison: 'ok' }] })
  const offres = Array.from({ length: 40 }, (_, i) => offre('o' + i)) // 2 lots
  const notes = await scorerOffres('cv', offres, { appeler: appeler as any })
  expect(notes.length).toBe(1) // le lot en échec est ignoré
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/scoring/scorer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter `src/lib/scoring/scorer.ts`**

```ts
import { appelerGeminiJson } from '@/lib/candidature/gemini'

export type OffreANoter = {
  ref: string; titre: string; entreprise: string | null; ville: string | null
  contrat: string | null; description: string | null
}
export type Note = { ref: string; score: number; raison: string }

const TAILLE_LOT = 20

const SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: { ref: { type: 'STRING' }, score: { type: 'INTEGER' }, raison: { type: 'STRING' } },
    required: ['ref', 'score', 'raison'],
  },
}

export function construirePromptScoring(cvTexte: string, offres: OffreANoter[]): string {
  const lignes = offres.map((o) =>
    `- ref ${o.ref} | ${o.titre} | ${o.entreprise ?? '?'} | ${o.ville ?? '?'} | ${o.contrat ?? '?'} | ${(o.description ?? '').slice(0, 400)}`)
  return [
    "Tu es un conseiller en recrutement spécialisé en diététique.",
    "Voici le CV d'un candidat, puis une liste d'offres.",
    "Pour CHAQUE offre, donne un score de 0 à 100 mesurant l'adéquation entre le profil du CV et l'offre,",
    "et une raison en une phrase courte (en français).",
    'Réponds STRICTEMENT en JSON : un tableau [{ ref, score, raison }], une entrée par ref fournie.',
    '',
    'CV :',
    cvTexte.slice(0, 6000),
    '',
    'OFFRES :',
    ...lignes,
  ].join('\n')
}

type Deps = { appeler?: typeof appelerGeminiJson }

export async function scorerOffres(cvTexte: string, offres: OffreANoter[], deps: Deps = {}): Promise<Note[]> {
  const appeler = deps.appeler ?? appelerGeminiJson
  const notes: Note[] = []
  for (let i = 0; i < offres.length; i += TAILLE_LOT) {
    const lot = offres.slice(i, i + TAILLE_LOT)
    try {
      const res = await appeler<Note[]>(construirePromptScoring(cvTexte, lot), SCHEMA)
      notes.push(...res)
    } catch (e) {
      console.error('[scoring] lot en échec :', e)
    }
  }
  return notes
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run src/lib/scoring/scorer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/scorer.ts src/lib/scoring/scorer.test.ts
git commit -m "feat(scoring): notation des offres par lots via Gemini (score + raison)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Intégration dans le cron

**Files:**
- Create: `src/lib/scoring/execution.ts`
- Test: `src/lib/scoring/execution.test.ts`
- Modify: `src/app/api/refresh/route.ts`

**Interfaces:**
- Consumes : `empreinteOffre`, `assurerCvTexte`, `scorerOffres`, `getProfil`.
- Produces : `preparerNotation(offres, dejaNotes)`, `lignesScores(userId, membres, notes)` (purs) ; `scorerPourRecherche(client, recherche, deps?) => Promise<number>`.

- [ ] **Step 1: Tests des fonctions pures (échouent d'abord)**

Créer `src/lib/scoring/execution.test.ts` :

```ts
import { expect, test } from 'vitest'
import { preparerNotation, lignesScores } from './execution'

const o = (id: string, titre = 'Diététicien', ville = 'Nantes', entreprise: string | null = 'CH') =>
  ({ id, titre, ville, entreprise, contrat: null, description: null } as any)

test('preparerNotation ignore les offres déjà notées et dédoublonne', () => {
  const offres = [o('1'), o('2'), o('3', 'Diététicien', 'Rennes')] // 1 et 2 = même empreinte
  const { aNoter, membres } = preparerNotation(offres, new Set())
  expect(aNoter).toHaveLength(2)                 // un groupe Nantes, un groupe Rennes
  const grpNantes = membres.get(aNoter[0].ref)!
  expect(grpNantes.sort()).toEqual(['1', '2'])   // les deux ids du groupe
})

test('preparerNotation saute une offre déjà notée', () => {
  const { aNoter } = preparerNotation([o('1'), o('9', 'Autre', 'Brest')], new Set(['1']))
  expect(aNoter.map((x) => x.ref)).toEqual(['9'])
})

test('lignesScores réétale le score sur tous les ids du groupe', () => {
  const membres = new Map([['1', ['1', '2']]])
  const notes = new Map([['1', { ref: '1', score: 88, raison: 'ok' }]])
  const rows = lignesScores('u1', membres, notes)
  expect(rows).toEqual([
    { user_id: 'u1', offre_id: '1', score: 88, raison: 'ok' },
    { user_id: 'u1', offre_id: '2', score: 88, raison: 'ok' },
  ])
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/scoring/execution.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter `src/lib/scoring/execution.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { empreinteOffre } from '@/lib/offres/dedup-affichage'
import { getProfil } from '@/lib/profil'
import { assurerCvTexte } from './cv'
import { scorerOffres, type OffreANoter, type Note } from './scorer'

type OffreDb = { id: string; titre: string; entreprise: string | null; ville: string | null; contrat: string | null; description: string | null }

// Regroupe par empreinte les offres non notées ; renvoie une offre par groupe (ref = 1er id)
// plus la liste complète des ids de chaque groupe.
export function preparerNotation(
  offres: OffreDb[], dejaNotes: Set<string>,
): { aNoter: OffreANoter[]; membres: Map<string, string[]> } {
  const aNoter: OffreANoter[] = []
  const membres = new Map<string, string[]>()
  const refParEmpreinte = new Map<string, string>()
  for (const o of offres) {
    if (dejaNotes.has(o.id)) continue
    const emp = empreinteOffre(o)
    const ref = refParEmpreinte.get(emp)
    if (ref) { membres.get(ref)!.push(o.id); continue }
    refParEmpreinte.set(emp, o.id)
    membres.set(o.id, [o.id])
    aNoter.push({ ref: o.id, titre: o.titre, entreprise: o.entreprise, ville: o.ville, contrat: o.contrat, description: o.description })
  }
  return { aNoter, membres }
}

export function lignesScores(
  userId: string, membres: Map<string, string[]>, notes: Map<string, Note>,
): { user_id: string; offre_id: string; score: number; raison: string }[] {
  const rows: { user_id: string; offre_id: string; score: number; raison: string }[] = []
  for (const [ref, ids] of membres) {
    const note = notes.get(ref)
    if (!note) continue
    const score = Math.max(0, Math.min(100, Math.round(note.score)))
    for (const offre_id of ids) rows.push({ user_id: userId, offre_id, score, raison: note.raison })
  }
  return rows
}

type Recherche = { id: string; user_id: string }
type Deps = { scorer?: typeof scorerOffres }

export async function scorerPourRecherche(client: SupabaseClient, recherche: Recherche, deps: Deps = {}): Promise<number> {
  const scorer = deps.scorer ?? scorerOffres
  const profil = await getProfil(client, recherche.user_id)
  if (!profil) return 0
  const cvTexte = await assurerCvTexte(client, recherche.user_id, profil)
  if (!cvTexte) return 0

  const { data: liees } = await client
    .from('resultats')
    .select('offres:offre_id (id, titre, entreprise, ville, contrat, description)')
    .eq('recherche_id', recherche.id)
  const offres = (liees ?? [])
    .map((r: any) => (Array.isArray(r.offres) ? r.offres[0] : r.offres))
    .filter(Boolean) as OffreDb[]
  if (offres.length === 0) return 0

  const { data: dejaData } = await client
    .from('scores').select('offre_id').eq('user_id', recherche.user_id)
    .in('offre_id', offres.map((o) => o.id))
  const dejaNotes = new Set((dejaData ?? []).map((r: { offre_id: string }) => r.offre_id))

  const { aNoter, membres } = preparerNotation(offres, dejaNotes)
  if (aNoter.length === 0) return 0

  const notesArr = await scorer(cvTexte, aNoter)
  const notes = new Map(notesArr.map((n) => [n.ref, n]))
  const rows = lignesScores(recherche.user_id, membres, notes)
  if (rows.length === 0) return 0

  const { error } = await client.from('scores').upsert(rows, { onConflict: 'user_id,offre_id', ignoreDuplicates: true })
  if (error) throw error
  return rows.length
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run src/lib/scoring/execution.test.ts`
Expected: PASS.

- [ ] **Step 5: Brancher dans `/api/refresh`**

Dans `src/app/api/refresh/route.ts` :

Import :
```ts
import { scorerPourRecherche } from '@/lib/scoring/execution'
```

Dans `traiter`, dans la boucle `for (const r of recherches)`, après `rafraichirEtEnregistrer`, ajouter le scoring (isolé) et cumuler :

```ts
    try { scores += await scorerPourRecherche(client, r) }
    catch (e) { console.error('[refresh] scoring en échec :', e) }
```
Déclarer `let scores = 0` avec `nouvelles`/`emails`, et l'ajouter au retour : `{ recherches: recherches.length, nouvelles, emails, purgees, scores }`.

- [ ] **Step 6: Vérifier suite + build**

Run: `npx vitest run src/lib/scoring/ src/app/api/refresh/ && npx next build`
Expected: PASS, build réussi.

- [ ] **Step 7: Commit**

```bash
git add src/lib/scoring/execution.ts src/lib/scoring/execution.test.ts src/app/api/refresh/route.ts
git commit -m "feat(scoring): notation dans le cron (dédup + réétalement + upsert)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Affichage (badge, couleur, aura, tri)

**Files:**
- Create: `src/lib/scoring/lecture.ts`, `src/lib/scoring/palette.ts`, `src/lib/scoring/palette.test.ts`
- Modify: `src/app/recherche/[id]/page.tsx`, `src/components/resultats-shell.tsx`, `offre-liste.tsx`, `offre-card.tsx`, `src/app/globals.css`

**Interfaces:**
- Produces : `getScores(client, userId, offreIds) => Promise<Map<string, { score: number; raison: string | null }>>` ; `couleurScore(score) => string` ; `estTopMatch(score) => boolean`.

- [ ] **Step 1: Tests de la palette (échouent d'abord)**

Créer `src/lib/scoring/palette.test.ts` :

```ts
import { expect, test } from 'vitest'
import { couleurScore, estTopMatch } from './palette'

test('couleurScore vire au rouge en bas, au vert en haut', () => {
  const bas = couleurScore(10)
  const haut = couleurScore(95)
  expect(bas).toContain('hsl(')
  // teinte plus élevée (plus verte) pour un meilleur score
  const t = (s: string) => Number(s.match(/hsl\((\d+)/)![1])
  expect(t(haut)).toBeGreaterThan(t(bas))
})

test('estTopMatch vrai à partir de 90', () => {
  expect(estTopMatch(90)).toBe(true)
  expect(estTopMatch(89)).toBe(false)
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/scoring/palette.test.ts`
Expected: FAIL.

- [ ] **Step 3: `src/lib/scoring/palette.ts`**

```ts
// Couleur du badge de score : rouge (0) -> vert (100), teinte HSL continue.
export function couleurScore(score: number): string {
  const s = Math.max(0, Math.min(100, score))
  const teinte = Math.round(s * 1.2) // 0 = rouge, 120 = vert
  return `hsl(${teinte}, 68%, 42%)`
}

export function estTopMatch(score: number): boolean {
  return score >= 90
}
```

- [ ] **Step 4: `src/lib/scoring/lecture.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getScores(
  client: SupabaseClient, userId: string, offreIds: string[],
): Promise<Map<string, { score: number; raison: string | null }>> {
  const map = new Map<string, { score: number; raison: string | null }>()
  if (offreIds.length === 0) return map
  const { data, error } = await client
    .from('scores').select('offre_id, score, raison')
    .eq('user_id', userId).in('offre_id', offreIds)
  if (error) throw error
  for (const r of (data ?? []) as { offre_id: string; score: number; raison: string | null }[]) {
    map.set(r.offre_id, { score: Math.max(0, Math.min(100, r.score)), raison: r.raison })
  }
  return map
}
```

- [ ] **Step 5: Lancer les tests palette (succès)**

Run: `npx vitest run src/lib/scoring/palette.test.ts`
Expected: PASS.

- [ ] **Step 6: Fusionner les scores dans la page résultats**

Dans `src/app/recherche/[id]/page.tsx`, après `dedupeAffichage`, charger et fusionner les scores :

```ts
import { getScores } from '@/lib/scoring/lecture'
```
```ts
  const deduped = dedupeAffichage(/* ... comme avant ... */)
  const scores = await getScores(supabase, user.id, deduped.map((o) => o.id))
  const offres = deduped.map((o) => ({ ...o, ...scores.get(o.id) }))
```
(le bloc `filtrerDansRayon` reste à l'intérieur de `dedupeAffichage` comme actuellement).

- [ ] **Step 7: Propager le type + badge dans la carte**

Type d'affichage : `OffreAffichee & { score?: number; raison?: string | null }`. Dans `resultats-shell.tsx` et `offre-liste.tsx`, élargir le type des offres avec `& { score?: number; raison?: string | null }`.

Dans `offre-card.tsx`, étendre le type de `offre` avec `score?: number; raison?: string | null`, importer la palette, et ajouter le badge (par ex. en tête de carte) :

```tsx
import { couleurScore, estTopMatch } from '@/lib/scoring/palette'
```
```tsx
      {typeof offre.score === 'number' && (
        <div className={`score-badge${estTopMatch(offre.score) ? ' match-top' : ''}`}
          style={{ backgroundColor: couleurScore(offre.score) }}>
          {offre.score}%
          {offre.raison && <span className="score-raison">{offre.raison}</span>}
        </div>
      )}
```

- [ ] **Step 8: Styles (badge, aura, box raison)**

Dans `src/app/globals.css` :

```css
.score-badge { position: absolute; top: 13px; left: 13px; z-index: 2; color: #fff; font-weight: 800;
  font-size: .8rem; padding: 3px 9px; border-radius: 999px; cursor: default; }
.score-badge .score-raison { display: none; position: absolute; top: calc(100% + 6px); left: 0;
  width: 230px; background: #fff; color: var(--ink); border: 1px solid var(--line); border-radius: 10px;
  padding: 8px 10px; font-size: .78rem; font-weight: 500; line-height: 1.4; box-shadow: 0 12px 30px rgba(16,20,17,.18); }
.score-badge:hover .score-raison { display: block; }
.score-badge.match-top { animation: aura-top 1.8s ease-in-out infinite; }
@keyframes aura-top {
  0%, 100% { box-shadow: 0 0 0 0 rgba(46,158,91,.55); }
  50% { box-shadow: 0 0 0 7px rgba(46,158,91,0); }
}
```

Note : la carte a déjà `position: relative` (le bouton like est en `absolute`). Si nécessaire, s'assurer que `.card` est `position: relative`.

- [ ] **Step 9: Bouton tri par pertinence**

Dans `resultats-shell.tsx`, ajouter un état `triPertinence` et un bouton "Trier par pertinence" ; quand actif, trier une copie de `visibles` par `score` décroissant (offres sans score en fin), sinon garder l'ordre (date). Appliquer ce tri au tableau passé à `OffreListe` et `CarteOffres`.

- [ ] **Step 10: Vérifier suite complète + build**

Run: `npx vitest run && npx next build`
Expected: tous les tests passent, build réussi.

- [ ] **Step 11: Commit**

```bash
git add src/lib/scoring/lecture.ts src/lib/scoring/palette.ts src/lib/scoring/palette.test.ts src/app/recherche/ src/components/resultats-shell.tsx src/components/offre-liste.tsx src/components/offre-card.tsx src/app/globals.css
git commit -m "feat(scoring): badge de score (couleur rouge→vert, aura ≥90, raison au survol) + tri par pertinence

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes hors code

- Migration `0012_scores.sql` à appliquer sur Supabase (comme 0010/0011) : SQL editor du dashboard.
- Le scoring tourne dans le cron `/api/refresh` : les scores apparaissent après le premier passage post-déploiement (ou lancement manuel du cron).
- Sous-projet 3b (ensuite) : mise en avant des offres ≥90 dans la cloche et l'email.
