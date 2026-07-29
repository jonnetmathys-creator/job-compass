# JobCompass · Brique 4 : la Candidature assistée · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pour une offre donnée, générer via Google Gemini (gratuit) un email de candidature + une lettre de motivation personnalisés à partir du CV et de la lettre de base (PDF) de l'utilisateur, éditables, copiables et téléchargeables en PDF.

**Architecture:** Le profil accueille un second PDF (lettre de base). Un moteur Gemini isolé et injectable (`fetch` REST, pas de SDK) lit les deux PDF + les infos de l'offre et renvoie `{ email_objet, email_corps, lettre }` en JSON. Une couche de logique testable (client Supabase injecté) télécharge les PDF, appelle Gemini et persiste la candidature par offre. Un écran client `/offre/[id]/candidature` déclenche la génération, laisse éditer, enregistrer, régénérer, copier et imprimer en PDF.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `params` = Promise), React 19, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Google Gemini `gemini-2.0-flash` via `fetch` natif, Vitest + @testing-library/react.

## Global Constraints

- **Spec de référence :** `docs/superpowers/specs/2026-07-28-jobcompass-mvp-4-candidature-design.md`. En cas de doute, la spec prime.
- **Aucune nouvelle dépendance npm.** `fetch` natif uniquement pour Gemini (cohérent avec l'adaptateur France Travail). Pas de lib PDF : le téléchargement PDF passe par `window.print()`.
- **`GEMINI_API_KEY` reste côté serveur.** Jamais lue dans un composant client ni exposée au navigateur. Lecture via `requireEnv('GEMINI_API_KEY')` dans du code serveur uniquement.
- **Tout module Vitest DOIT importer explicitement ses helpers :** `import { expect, test, vi } from 'vitest'`. Sans cet import, `tsc` / `next build` cassent (le `tsconfig` inclut `**/*.ts`). `globals: true` est actif mais l'import reste obligatoire pour le typage.
- **Server Actions (`'use server'`) :** un fichier `'use server'` n'exporte QUE des fonctions `async`. La logique testable (qui prend un client injecté) vit dans un module SANS `'use server'`.
- **Français** dans toute copie visible et tout contenu généré. **Jamais de tiret cadratin `—`** dans le code, les commentaires ou la copie : utiliser `:`, `,` ou `·`.
- **Injection de dépendances pour la testabilité :** tout appel réseau (`fetch`) et tout accès Supabase passe par un paramètre injectable, comme `searchFranceTravail(params, { fetchImpl })` et `storeOffres(client, ...)`.
- **Migrations :** fichiers `supabase/migrations/000N_*.sql` numérotés à la suite (dernier existant = `0004`). Elles seront appliquées manuellement sur Supabase distant après merge ; le plan ne les exécute pas.
- **CV et lettre stockés dans le bucket `cv`** aux chemins `${userId}/cv.pdf` et `${userId}/lettre.pdf`.

---

## File Structure

**Créés :**
- `supabase/migrations/0005_lettre_url.sql` : colonne `profils.lettre_url`.
- `supabase/migrations/0006_candidatures.sql` : table `candidatures` + RLS.
- `src/lib/candidature/types.ts` : types partagés (`Candidature`, `CandidatureContenu`, `OffreInfo`, `ProfilInfo`, `GeminiParams`).
- `src/lib/candidature/gemini.ts` : `buildPrompt`, `parseReponse`, `appelerGemini` (pur + fetch injectable).
- `src/lib/candidature/lecture.ts` : `getCandidature`, `upsertCandidature` (client injecté).
- `src/lib/candidature/generation.ts` : `genererCandidatureCore` (orchestration testable, client + gemini injectés).
- `src/lib/candidature/actions.ts` (`'use server'`) : `genererCandidature`, `enregistrerCandidature`.
- `src/app/offre/[id]/candidature/page.tsx` : page serveur.
- `src/components/candidature-editor.tsx` : éditeur client.
- `src/components/lettre-imprimable.tsx` : vue imprimable de la lettre.
- Tests colocalisés : `gemini.test.ts`, `lecture.test.ts`, `generation.test.ts`, `profil.test.ts` (nouveau), `candidature-editor.test.tsx`, `lettre-imprimable.test.tsx`.

**Modifiés :**
- `src/lib/profil.ts` : ajout `lettre_url` au type `Profil` + fonction `uploadLettre`.
- `src/app/profil/profil-form.tsx` : la lettre de base devient un upload PDF (remplace le `<textarea>`).
- `src/app/profil/page.tsx` : `initial` par défaut inclut `lettre_url: null`.
- `src/components/offre-detail.tsx` : le bouton « Candidater avec lettre IA · bientôt » devient un lien actif vers `/offre/[id]/candidature`.
- `src/app/globals.css` : styles d'impression `@media print` + styles de l'écran candidature.

---

### Task 1: Profil · lettre de base en PDF

**Files:**
- Create: `supabase/migrations/0005_lettre_url.sql`
- Modify: `src/lib/profil.ts`
- Modify: `src/app/profil/profil-form.tsx`
- Modify: `src/app/profil/page.tsx`
- Test: `src/lib/profil.test.ts`

**Interfaces:**
- Consumes: `Profil` (existant), `upsertProfil(client, userId, patch)`, `uploadCv(client, userId, file)` de `src/lib/profil.ts`.
- Produces: `Profil` gagne `lettre_url: string | null`. Nouvelle fonction `uploadLettre(client: SupabaseClient, userId: string, file: File): Promise<string>` qui upload sous `${userId}/lettre.pdf` et met à jour `lettre_url`. `Profil` est le contrat lu par la Task 4 (champs `cv_url` + `lettre_url`).

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/0005_lettre_url.sql` :

```sql
-- Lettre de motivation de base, uploadée en PDF (chemin dans le bucket cv).
-- La colonne texte lettre_base existante est conservée (non supprimée) mais
-- n'est plus utilisée par l'UI ni la génération.
alter table public.profils add column if not exists lettre_url text;
```

- [ ] **Step 2: Écrire le test qui échoue**

Créer `src/lib/profil.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { uploadLettre } from './profil'

test('uploadLettre upload sous {userId}/lettre.pdf et met à jour lettre_url', async () => {
  const upload = vi.fn().mockResolvedValue({ error: null })
  const select = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { user_id: 'u1', lettre_url: 'u1/lettre.pdf' }, error: null }) })
  const upsert = vi.fn().mockReturnValue({ select })
  const client = {
    storage: { from: vi.fn(() => ({ upload })) },
    from: vi.fn(() => ({ upsert })),
  } as any
  const file = new File(['x'], 'lettre.pdf', { type: 'application/pdf' })

  const path = await uploadLettre(client, 'u1', file)

  expect(client.storage.from).toHaveBeenCalledWith('cv')
  expect(upload).toHaveBeenCalledWith('u1/lettre.pdf', file, { upsert: true, contentType: 'application/pdf' })
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', lettre_url: 'u1/lettre.pdf' }))
  expect(path).toBe('u1/lettre.pdf')
})
```

- [ ] **Step 3: Lancer le test, vérifier qu'il échoue**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/profil.test.ts
```
Attendu : FAIL (`uploadLettre` non exporté).

- [ ] **Step 4: Implémenter**

Dans `src/lib/profil.ts`, ajouter `lettre_url` au type et la fonction `uploadLettre` (calquée sur `uploadCv`) :

```ts
export type Profil = {
  user_id: string
  nom: string | null
  titre_recherche: string | null
  cv_url: string | null
  lettre_base: string | null
  lettre_url: string | null
}
```

```ts
export async function uploadLettre(client: SupabaseClient, userId: string, file: File): Promise<string> {
  const path = `${userId}/lettre.pdf`
  const { error } = await client.storage.from('cv').upload(path, file, {
    upsert: true, contentType: 'application/pdf',
  })
  if (error) throw error
  await upsertProfil(client, userId, { lettre_url: path })
  return path
}
```

- [ ] **Step 5: Lancer le test, vérifier qu'il passe**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/profil.test.ts
```
Attendu : PASS.

- [ ] **Step 6: Câbler le formulaire profil**

Dans `src/app/profil/profil-form.tsx` : importer `uploadLettre` (`import { upsertProfil, uploadCv, uploadLettre, type Profil } from '@/lib/profil'`), retirer `lettre_base` de l'appel `upsertProfil` dans `save`, et remplacer le bloc `<textarea id="lettre">` (lignes ~39-44) par un champ upload PDF calqué sur le champ CV :

```tsx
<div>
  <label htmlFor="lettre" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Lettre de motivation de base (PDF)</label>
  <input id="lettre" type="file" accept="application/pdf"
    onChange={async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      setError(null)
      try {
        const supabase = getBrowserClient()
        const path = await uploadLettre(supabase, initial.user_id, file)
        setForm((prev) => ({ ...prev, lettre_url: path }))
        setSaved(true)
      } catch {
        setError("Échec de l'envoi de la lettre, réessayez.")
      }
    }}
    className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium file:cursor-pointer cursor-pointer"
    style={{ color: 'var(--muted)' }} />
  {form.lettre_url && <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>Lettre actuelle : {form.lettre_url}</p>}
</div>
```

- [ ] **Step 7: Mettre à jour le profil par défaut**

Dans `src/app/profil/page.tsx`, ajouter `lettre_url: null` à l'objet `initial` par défaut :

```tsx
const initial: Profil = existing ?? {
  user_id: user.id, nom: null, titre_recherche: null, cv_url: null, lettre_base: null, lettre_url: null,
}
```

- [ ] **Step 8: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 9: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(profil): lettre de base en PDF (lettre_url + uploadLettre)"
```

---

### Task 2: Table candidatures + lecture/écriture

**Files:**
- Create: `supabase/migrations/0006_candidatures.sql`
- Create: `src/lib/candidature/types.ts`
- Create: `src/lib/candidature/lecture.ts`
- Test: `src/lib/candidature/lecture.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient` de `@supabase/supabase-js`.
- Produces:
  - `type Candidature = { user_id: string; offre_id: string; email_objet: string | null; email_corps: string | null; lettre: string | null; statut: string }`
  - `type CandidatureContenu = { email_objet: string; email_corps: string; lettre: string }`
  - `getCandidature(client: SupabaseClient, userId: string, offreId: string): Promise<Candidature | null>`
  - `upsertCandidature(client: SupabaseClient, userId: string, offreId: string, contenu: CandidatureContenu): Promise<Candidature>`

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/0006_candidatures.sql` :

```sql
-- Candidature générée par offre (email + lettre + éditions).
create table if not exists public.candidatures (
  user_id uuid not null references auth.users(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  email_objet text,
  email_corps text,
  lettre text,
  statut text not null default 'brouillon',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, offre_id)
);

alter table public.candidatures enable row level security;

-- Chacun ne voit et ne gère que ses candidatures.
create policy candidatures_self on public.candidatures
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Créer les types**

Créer `src/lib/candidature/types.ts` :

```ts
export type Candidature = {
  user_id: string
  offre_id: string
  email_objet: string | null
  email_corps: string | null
  lettre: string | null
  statut: string
}

export type CandidatureContenu = {
  email_objet: string
  email_corps: string
  lettre: string
}

// Sous-ensemble de l'offre transmis au moteur Gemini.
export type OffreInfo = {
  titre: string
  entreprise: string | null
  ville: string | null
  contrat: string | null
  description: string | null
}

// Sous-ensemble du profil transmis au moteur Gemini.
export type ProfilInfo = {
  nom: string | null
  titre_recherche: string | null
}

export type GeminiParams = {
  offre: OffreInfo
  profil: ProfilInfo
  cvBase64: string
  lettreBase64: string
}
```

- [ ] **Step 3: Écrire les tests qui échouent**

Créer `src/lib/candidature/lecture.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { getCandidature, upsertCandidature } from './lecture'

test('getCandidature filtre sur user_id et offre_id et renvoie la ligne', async () => {
  const single = vi.fn().mockResolvedValue({
    data: { user_id: 'u1', offre_id: 'o1', email_objet: 'Obj', email_corps: 'Corps', lettre: 'L', statut: 'brouillon' },
    error: null,
  })
  const eq2 = vi.fn(() => ({ single }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  const select = vi.fn(() => ({ eq: eq1 }))
  const client = { from: vi.fn(() => ({ select })) } as any

  const cand = await getCandidature(client, 'u1', 'o1')

  expect(client.from).toHaveBeenCalledWith('candidatures')
  expect(eq1).toHaveBeenCalledWith('user_id', 'u1')
  expect(eq2).toHaveBeenCalledWith('offre_id', 'o1')
  expect(cand?.email_objet).toBe('Obj')
})

test('getCandidature renvoie null quand aucune ligne (PGRST116)', async () => {
  const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  const client = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ single }) }) }) })) } as any
  const cand = await getCandidature(client, 'u1', 'o1')
  expect(cand).toBeNull()
})

test('upsertCandidature upsert sur (user_id, offre_id) avec le contenu', async () => {
  const row = { user_id: 'u1', offre_id: 'o1', email_objet: 'O', email_corps: 'C', lettre: 'L', statut: 'brouillon' }
  const single = vi.fn().mockResolvedValue({ data: row, error: null })
  const select = vi.fn(() => ({ single }))
  const upsert = vi.fn(() => ({ select }))
  const client = { from: vi.fn(() => ({ upsert })) } as any

  const out = await upsertCandidature(client, 'u1', 'o1', { email_objet: 'O', email_corps: 'C', lettre: 'L' })

  expect(client.from).toHaveBeenCalledWith('candidatures')
  const [payload, opts] = upsert.mock.calls[0]
  expect(payload).toMatchObject({ user_id: 'u1', offre_id: 'o1', email_objet: 'O', email_corps: 'C', lettre: 'L' })
  expect(opts).toMatchObject({ onConflict: 'user_id,offre_id' })
  expect(out).toMatchObject({ user_id: 'u1', offre_id: 'o1' })
})
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils échouent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/candidature/lecture.test.ts
```
Attendu : FAIL (`getCandidature`/`upsertCandidature` non exportés).

- [ ] **Step 5: Implémenter**

Créer `src/lib/candidature/lecture.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Candidature, CandidatureContenu } from './types'

export async function getCandidature(
  client: SupabaseClient,
  userId: string,
  offreId: string,
): Promise<Candidature | null> {
  const { data, error } = await client
    .from('candidatures')
    .select('user_id, offre_id, email_objet, email_corps, lettre, statut')
    .eq('user_id', userId)
    .eq('offre_id', offreId)
    .single()
  // PGRST116 = aucune ligne : pas encore de candidature pour cette offre.
  if (error && error.code !== 'PGRST116') throw error
  return (data as Candidature) ?? null
}

export async function upsertCandidature(
  client: SupabaseClient,
  userId: string,
  offreId: string,
  contenu: CandidatureContenu,
): Promise<Candidature> {
  const { data, error } = await client
    .from('candidatures')
    .upsert(
      {
        user_id: userId,
        offre_id: offreId,
        email_objet: contenu.email_objet,
        email_corps: contenu.email_corps,
        lettre: contenu.lettre,
        statut: 'brouillon',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,offre_id' },
    )
    .select('user_id, offre_id, email_objet, email_corps, lettre, statut')
    .single()
  if (error) throw error
  return data as Candidature
}
```

- [ ] **Step 6: Lancer les tests, vérifier qu'ils passent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/candidature/lecture.test.ts
```
Attendu : PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(candidature): table candidatures + getCandidature/upsertCandidature"
```

---

### Task 3: Moteur Gemini (buildPrompt + parseReponse + appelerGemini)

**Files:**
- Create: `src/lib/candidature/gemini.ts`
- Test: `src/lib/candidature/gemini.test.ts`

**Interfaces:**
- Consumes: `OffreInfo`, `ProfilInfo`, `GeminiParams`, `CandidatureContenu` de `./types`. `requireEnv('GEMINI_API_KEY')` de `@/lib/env`.
- Produces:
  - `buildPrompt(offre: OffreInfo, profil: ProfilInfo): string` (pur)
  - `parseReponse(text: string): CandidatureContenu` (pur ; throw `Error('Réponse Gemini malformée')` si JSON invalide ou champ manquant/vide)
  - `appelerGemini(params: GeminiParams, deps?: { fetchImpl?: typeof fetch }): Promise<CandidatureContenu>`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/candidature/gemini.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { buildPrompt, parseReponse, appelerGemini } from './gemini'
import type { GeminiParams } from './types'

const offre = { titre: 'Diététicien', entreprise: 'Clinique du Parc', ville: 'Nantes', contrat: 'CDI', description: 'Suivi nutritionnel' }
const profil = { nom: 'Jean Dupont', titre_recherche: 'Diététicien' }

test('buildPrompt contient les infos offre, le profil et les consignes humain / pas d\'invention', () => {
  const p = buildPrompt(offre, profil)
  expect(p).toContain('Diététicien')
  expect(p).toContain('Clinique du Parc')
  expect(p).toContain('Nantes')
  expect(p).toContain('Jean Dupont')
  expect(p.toLowerCase()).toContain('humain')
  expect(p.toLowerCase()).toContain('inventer')
  expect(p).toContain('email_objet')
})

test('parseReponse valide un JSON conforme', () => {
  const out = parseReponse('{"email_objet":"O","email_corps":"C","lettre":"L"}')
  expect(out).toEqual({ email_objet: 'O', email_corps: 'C', lettre: 'L' })
})

test('parseReponse rejette un JSON malformé', () => {
  expect(() => parseReponse('pas du json')).toThrow(/malform/i)
})

test('parseReponse rejette un champ manquant ou vide', () => {
  expect(() => parseReponse('{"email_objet":"O","email_corps":"C"}')).toThrow(/malform/i)
  expect(() => parseReponse('{"email_objet":"","email_corps":"C","lettre":"L"}')).toThrow(/malform/i)
})

test('appelerGemini poste sur l\'endpoint avec deux PDF inline et le schéma JSON', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: '{"email_objet":"O","email_corps":"C","lettre":"L"}' }] } }],
    }),
  })
  const params: GeminiParams = { offre, profil, cvBase64: 'CV_B64', lettreBase64: 'LET_B64' }

  const out = await appelerGemini(params, { fetchImpl: fetchImpl as any })

  expect(out).toEqual({ email_objet: 'O', email_corps: 'C', lettre: 'L' })
  const [url, init] = fetchImpl.mock.calls[0]
  expect(String(url)).toContain('gemini-2.0-flash')
  expect(init.method).toBe('POST')
  const body = JSON.parse(init.body)
  const parts = body.contents[0].parts
  const pdfs = parts.filter((p: any) => p.inline_data?.mime_type === 'application/pdf')
  expect(pdfs.map((p: any) => p.inline_data.data)).toEqual(['CV_B64', 'LET_B64'])
  expect(body.generationConfig.response_mime_type).toBe('application/json')
  expect(body.generationConfig.response_schema.required).toEqual(
    expect.arrayContaining(['email_objet', 'email_corps', 'lettre']),
  )
})

test('appelerGemini lève une erreur claire sur réponse HTTP non ok', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'quota' })
  const params: GeminiParams = { offre, profil, cvBase64: 'A', lettreBase64: 'B' }
  await expect(appelerGemini(params, { fetchImpl: fetchImpl as any })).rejects.toThrow(/Gemini/i)
})
```

Note : le test lit `GEMINI_API_KEY` via `requireEnv`. `vitest.setup.ts` ne la définit pas ; ajouter en tête de fichier de test, avant les `test(...)` : `process.env.GEMINI_API_KEY ??= 'test-key'`.

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/candidature/gemini.test.ts
```
Attendu : FAIL (module `./gemini` absent).

- [ ] **Step 3: Implémenter**

Créer `src/lib/candidature/gemini.ts` :

```ts
import { requireEnv } from '@/lib/env'
import type { OffreInfo, ProfilInfo, GeminiParams, CandidatureContenu } from './types'

const MODEL = 'gemini-2.0-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export function buildPrompt(offre: OffreInfo, profil: ProfilInfo): string {
  return [
    "Tu es un assistant de candidature pour un professionnel de la diététique.",
    "À partir du CV et de la lettre de motivation de base fournis en pièces jointes (PDF),",
    "rédige un email de candidature et une lettre de motivation personnalisés pour l'offre ci-dessous.",
    '',
    'OFFRE :',
    `- Intitulé : ${offre.titre}`,
    `- Employeur : ${offre.entreprise ?? 'non précisé'}`,
    `- Ville : ${offre.ville ?? 'non précisée'}`,
    `- Contrat : ${offre.contrat ?? 'non précisé'}`,
    `- Description : ${offre.description ?? 'non fournie'}`,
    '',
    'CANDIDAT :',
    `- Nom : ${profil.nom ?? 'non précisé'}`,
    `- Poste recherché : ${profil.titre_recherche ?? 'non précisé'}`,
    '',
    'CONSIGNES :',
    "- Email court et professionnel (objet + corps) accompagnant la candidature.",
    "- Lettre de motivation structurée, personnalisée à l'offre (employeur, missions, ville),",
    "  appuyée sur le CV (parcours, expériences, diplômes) et reprenant l'esprit et le ton de la lettre de base.",
    "- Ton naturel et humain, sobre, sans tournures robotiques ni formules génériques creuses.",
    "- N'invente aucun fait absent du CV ou de la lettre de base.",
    "- Rédige en français.",
    '- Réponds STRICTEMENT au format JSON : { email_objet, email_corps, lettre }.',
  ].join('\n')
}

export function parseReponse(text: string): CandidatureContenu {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error('Réponse Gemini malformée')
  }
  const o = obj as Record<string, unknown>
  const champs = ['email_objet', 'email_corps', 'lettre'] as const
  for (const c of champs) {
    if (typeof o[c] !== 'string' || (o[c] as string).trim() === '') {
      throw new Error('Réponse Gemini malformée')
    }
  }
  return { email_objet: o.email_objet as string, email_corps: o.email_corps as string, lettre: o.lettre as string }
}

export async function appelerGemini(
  params: GeminiParams,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<CandidatureContenu> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildPrompt(params.offre, params.profil) },
          { inline_data: { mime_type: 'application/pdf', data: params.cvBase64 } },
          { inline_data: { mime_type: 'application/pdf', data: params.lettreBase64 } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: {
        type: 'OBJECT',
        properties: {
          email_objet: { type: 'STRING' },
          email_corps: { type: 'STRING' },
          lettre: { type: 'STRING' },
        },
        required: ['email_objet', 'email_corps', 'lettre'],
      },
    },
  }
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': requireEnv('GEMINI_API_KEY'),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Appel Gemini échoué : HTTP ${res.status} ${detail}`.trim())
  }
  const json = await res.json()
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Appel Gemini : réponse vide')
  return parseReponse(text)
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/candidature/gemini.test.ts
```
Attendu : PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(candidature): moteur Gemini (buildPrompt, parseReponse, appelerGemini)"
```

---

### Task 4: Orchestration + Server Actions

**Files:**
- Create: `src/lib/candidature/generation.ts`
- Create: `src/lib/candidature/actions.ts`
- Test: `src/lib/candidature/generation.test.ts`

**Interfaces:**
- Consumes: `getProfil` de `@/lib/profil` ; `appelerGemini` de `./gemini` ; `getCandidature`, `upsertCandidature` de `./lecture` ; types de `./types` ; `getServerClient` de `@/lib/supabase/server`.
- Produces:
  - `genererCandidatureCore(deps: { client: SupabaseClient; userId: string; offreId: string; appelerGeminiImpl?: typeof appelerGemini }): Promise<Candidature>`
  - Server Actions : `genererCandidature(offreId: string): Promise<Candidature>` ; `enregistrerCandidature(offreId: string, patch: CandidatureContenu): Promise<void>`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/lib/candidature/generation.test.ts` :

```ts
import { expect, test, vi } from 'vitest'
import { genererCandidatureCore } from './generation'

// Blob factice avec arrayBuffer() -> pour le téléchargement des PDF.
function fakeBlob(bytes: number[]) {
  return { arrayBuffer: async () => new Uint8Array(bytes).buffer }
}

function makeClient(profil: any) {
  const download = vi.fn().mockResolvedValue({ data: fakeBlob([1, 2, 3]), error: null })
  const offreSingle = vi.fn().mockResolvedValue({
    data: { titre: 'Diét', entreprise: 'C', ville: 'Nantes', contrat: 'CDI', description: 'd' }, error: null,
  })
  const candSingle = vi.fn().mockResolvedValue({
    data: { user_id: 'u1', offre_id: 'o1', email_objet: 'O', email_corps: 'C', lettre: 'L', statut: 'brouillon' }, error: null,
  })
  const client: any = {
    storage: { from: vi.fn(() => ({ download })) },
    from: vi.fn((table: string) => {
      if (table === 'profils') return { select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: profil, error: null }) }) }) }
      if (table === 'offres') return { select: () => ({ eq: () => ({ single: offreSingle }) }) }
      if (table === 'candidatures') return { upsert: () => ({ select: () => ({ single: candSingle }) }) }
      throw new Error('table inattendue ' + table)
    }),
  }
  return { client, download }
}

test('profil complet : appelle Gemini avec deux PDF et upsert le résultat', async () => {
  const profil = { user_id: 'u1', nom: 'Jean', titre_recherche: 'Diét', cv_url: 'u1/cv.pdf', lettre_url: 'u1/lettre.pdf', lettre_base: null }
  const { client, download } = makeClient(profil)
  const appelerGeminiImpl = vi.fn().mockResolvedValue({ email_objet: 'O', email_corps: 'C', lettre: 'L' })

  const out = await genererCandidatureCore({ client, userId: 'u1', offreId: 'o1', appelerGeminiImpl })

  expect(download).toHaveBeenCalledTimes(2)
  expect(appelerGeminiImpl).toHaveBeenCalledTimes(1)
  const arg = appelerGeminiImpl.mock.calls[0][0]
  expect(typeof arg.cvBase64).toBe('string')
  expect(typeof arg.lettreBase64).toBe('string')
  expect(out).toMatchObject({ email_objet: 'O', lettre: 'L' })
})

test('profil incomplet (CV manquant) : lève une erreur, pas d\'appel Gemini', async () => {
  const profil = { user_id: 'u1', nom: 'Jean', titre_recherche: 'Diét', cv_url: null, lettre_url: 'u1/lettre.pdf', lettre_base: null }
  const { client } = makeClient(profil)
  const appelerGeminiImpl = vi.fn()
  await expect(genererCandidatureCore({ client, userId: 'u1', offreId: 'o1', appelerGeminiImpl })).rejects.toThrow(/incomplet/i)
  expect(appelerGeminiImpl).not.toHaveBeenCalled()
})

test('profil incomplet (lettre manquante) : lève une erreur', async () => {
  const profil = { user_id: 'u1', nom: 'Jean', titre_recherche: 'Diét', cv_url: 'u1/cv.pdf', lettre_url: null, lettre_base: null }
  const { client } = makeClient(profil)
  const appelerGeminiImpl = vi.fn()
  await expect(genererCandidatureCore({ client, userId: 'u1', offreId: 'o1', appelerGeminiImpl })).rejects.toThrow(/incomplet/i)
  expect(appelerGeminiImpl).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/candidature/generation.test.ts
```
Attendu : FAIL (module `./generation` absent).

- [ ] **Step 3: Implémenter l'orchestration**

Créer `src/lib/candidature/generation.ts` (PAS de `'use server'` : module testable) :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { getProfil } from '@/lib/profil'
import { appelerGemini } from './gemini'
import { upsertCandidature } from './lecture'
import type { Candidature, OffreInfo } from './types'

async function blobToBase64(blob: { arrayBuffer: () => Promise<ArrayBuffer> }): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer())
  return buf.toString('base64')
}

async function telechargerPdf(client: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await client.storage.from('cv').download(path)
  if (error || !data) throw new Error(`PDF illisible : ${path}`)
  return blobToBase64(data as unknown as { arrayBuffer: () => Promise<ArrayBuffer> })
}

export async function genererCandidatureCore(deps: {
  client: SupabaseClient
  userId: string
  offreId: string
  appelerGeminiImpl?: typeof appelerGemini
}): Promise<Candidature> {
  const { client, userId, offreId } = deps
  const appeler = deps.appelerGeminiImpl ?? appelerGemini

  const profil = await getProfil(client, userId)
  if (!profil?.cv_url || !profil?.lettre_url) {
    throw new Error('Profil incomplet : ajoute ton CV et ta lettre de base (PDF) avant de générer.')
  }

  const { data: offre, error: offreErr } = await client
    .from('offres')
    .select('titre, entreprise, ville, contrat, description')
    .eq('id', offreId)
    .single()
  if (offreErr || !offre) throw new Error('Offre introuvable')

  const [cvBase64, lettreBase64] = await Promise.all([
    telechargerPdf(client, profil.cv_url),
    telechargerPdf(client, profil.lettre_url),
  ])

  const contenu = await appeler({
    offre: offre as OffreInfo,
    profil: { nom: profil.nom, titre_recherche: profil.titre_recherche },
    cvBase64,
    lettreBase64,
  })

  return upsertCandidature(client, userId, offreId, contenu)
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/lib/candidature/generation.test.ts
```
Attendu : PASS.

- [ ] **Step 5: Écrire les Server Actions**

Créer `src/lib/candidature/actions.ts` :

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { getServerClient } from '@/lib/supabase/server'
import { genererCandidatureCore } from './generation'
import { upsertCandidature } from './lecture'
import type { Candidature, CandidatureContenu } from './types'

export async function genererCandidature(offreId: string): Promise<Candidature> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const cand = await genererCandidatureCore({ client: supabase, userId: user.id, offreId })
  revalidatePath(`/offre/${offreId}/candidature`)
  return cand
}

export async function enregistrerCandidature(offreId: string, patch: CandidatureContenu): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  await upsertCandidature(supabase, user.id, offreId, patch)
  revalidatePath(`/offre/${offreId}/candidature`)
}
```

- [ ] **Step 6: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 7: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(candidature): orchestration genererCandidatureCore + Server Actions"
```

---

### Task 5: Écran candidature (page serveur + éditeur client)

**Files:**
- Create: `src/app/offre/[id]/candidature/page.tsx`
- Create: `src/components/candidature-editor.tsx`
- Modify: `src/app/globals.css` (styles écran candidature)
- Test: `src/components/candidature-editor.test.tsx`

**Interfaces:**
- Consumes: `getServerClient` ; `OFFRE_COLUMNS`, `OffreRow` de `@/lib/offres/types` ; `getProfil` de `@/lib/profil` ; `getCandidature` de `@/lib/candidature/lecture` ; `genererCandidature`, `enregistrerCandidature` de `@/lib/candidature/actions` ; `Candidature` de `@/lib/candidature/types`.
- Produces: composant `CandidatureEditor` recevant `{ offre: OffreRow; profilComplet: boolean; candidatureInitiale: Candidature | null }`. La Task 6 rendra `<LettreImprimable>` à l'intérieur de cet éditeur.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/components/candidature-editor.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import CandidatureEditor from './candidature-editor'
import type { OffreRow } from '@/lib/offres/types'

vi.mock('@/lib/candidature/actions', () => ({
  genererCandidature: vi.fn(),
  enregistrerCandidature: vi.fn(),
}))

const offre = {
  id: 'o1', source: 'x', source_id: 'x', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
  description: null, contrat: 'CDI', salaire: null, latitude: null, longitude: null, ville: 'Nantes',
  url_postuler: null, email_contact: null, date_publication: null,
} as OffreRow

test('profil incomplet : message + lien vers le profil, pas de bouton Générer', () => {
  render(<CandidatureEditor offre={offre} profilComplet={false} candidatureInitiale={null} />)
  expect(screen.getByText(/ton profil/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /profil/i })).toHaveAttribute('href', '/profil')
  expect(screen.queryByRole('button', { name: /générer/i })).toBeNull()
})

test('profil complet sans candidature : bouton Générer', () => {
  render(<CandidatureEditor offre={offre} profilComplet={true} candidatureInitiale={null} />)
  expect(screen.getByRole('button', { name: /générer ma candidature/i })).toBeInTheDocument()
})

test('candidature présente : champs éditables + boutons copier', () => {
  const cand = { user_id: 'u1', offre_id: 'o1', email_objet: 'Objet', email_corps: 'Corps', lettre: 'Ma lettre', statut: 'brouillon' }
  render(<CandidatureEditor offre={offre} profilComplet={true} candidatureInitiale={cand} />)
  expect((screen.getByLabelText(/objet/i) as HTMLInputElement).value).toBe('Objet')
  expect((screen.getByLabelText(/corps de l'email/i) as HTMLTextAreaElement).value).toBe('Corps')
  expect((screen.getByLabelText(/lettre/i) as HTMLTextAreaElement).value).toBe('Ma lettre')
  expect(screen.getByRole('button', { name: /copier l'email/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /copier la lettre/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/candidature-editor.test.tsx
```
Attendu : FAIL (composant absent).

- [ ] **Step 3: Implémenter l'éditeur**

Créer `src/components/candidature-editor.tsx` :

```tsx
'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { OffreRow } from '@/lib/offres/types'
import type { Candidature } from '@/lib/candidature/types'
import { genererCandidature, enregistrerCandidature } from '@/lib/candidature/actions'

export default function CandidatureEditor({
  offre, profilComplet, candidatureInitiale,
}: {
  offre: OffreRow
  profilComplet: boolean
  candidatureInitiale: Candidature | null
}) {
  const [cand, setCand] = useState<Candidature | null>(candidatureInitiale)
  const [objet, setObjet] = useState(candidatureInitiale?.email_objet ?? '')
  const [corps, setCorps] = useState(candidatureInitiale?.email_corps ?? '')
  const [lettre, setLettre] = useState(candidatureInitiale?.lettre ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function appliquer(c: Candidature) {
    setCand(c)
    setObjet(c.email_objet ?? '')
    setCorps(c.email_corps ?? '')
    setLettre(c.lettre ?? '')
  }

  function generer() {
    setErreur(null); setInfo(null)
    startTransition(async () => {
      try {
        appliquer(await genererCandidature(offre.id))
      } catch {
        setErreur('La génération a échoué, réessaie.')
      }
    })
  }

  function regenerer() {
    if (!window.confirm('Régénérer va remplacer la candidature actuelle. Continuer ?')) return
    generer()
  }

  function enregistrer() {
    setErreur(null); setInfo(null)
    startTransition(async () => {
      try {
        await enregistrerCandidature(offre.id, { email_objet: objet, email_corps: corps, lettre })
        setInfo('Enregistré ✓')
      } catch {
        setErreur("Échec de l'enregistrement, réessaie.")
      }
    })
  }

  async function copier(texte: string, quoi: string) {
    try {
      await navigator.clipboard.writeText(texte)
      setInfo(`${quoi} copié ✓`)
    } catch {
      setErreur('Copie impossible.')
    }
  }

  if (!profilComplet) {
    return (
      <div className="cand-empty">
        <p>Ajoute ton CV et ta lettre de base (PDF) dans ton profil avant de générer ta candidature.</p>
        <Link href="/profil" className="btn-primary">Compléter mon profil</Link>
      </div>
    )
  }

  if (!cand) {
    return (
      <div className="cand-empty">
        <button type="button" className="btn-primary" onClick={generer} disabled={isPending}>
          {isPending ? "L'IA rédige ta candidature…" : 'Générer ma candidature'}
        </button>
        {erreur && <p className="cand-err">{erreur}</p>}
      </div>
    )
  }

  return (
    <div className="cand-editor">
      <section className="cand-block">
        <h3>Email de candidature</h3>
        <label htmlFor="objet">Objet</label>
        <input id="objet" value={objet} onChange={(e) => setObjet(e.target.value)} />
        <label htmlFor="corps">Corps de l'email</label>
        <textarea id="corps" rows={7} value={corps} onChange={(e) => setCorps(e.target.value)} />
        <button type="button" className="btn-ghost" onClick={() => copier(`${objet}\n\n${corps}`, "L'email")}>Copier l'email</button>
      </section>

      <section className="cand-block">
        <h3>Lettre de motivation</h3>
        <label htmlFor="lettre">Lettre</label>
        <textarea id="lettre" rows={16} value={lettre} onChange={(e) => setLettre(e.target.value)} />
        <div className="cand-actions">
          <button type="button" className="btn-ghost" onClick={() => copier(lettre, 'La lettre')}>Copier la lettre</button>
        </div>
      </section>

      <div className="cand-actions">
        <button type="button" className="btn-primary" onClick={enregistrer} disabled={isPending}>Enregistrer</button>
        <button type="button" className="btn-ghost" onClick={regenerer} disabled={isPending}>
          {isPending ? '…' : 'Régénérer'}
        </button>
        {info && <span className="cand-ok">{info}</span>}
        {erreur && <span className="cand-err">{erreur}</span>}
      </div>
    </div>
  )
}
```

Note : le bouton « Télécharger la lettre en PDF » et le rendu `<LettreImprimable>` sont ajoutés en Task 6.

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/candidature-editor.test.tsx
```
Attendu : PASS.

- [ ] **Step 5: Créer la page serveur**

Créer `src/app/offre/[id]/candidature/page.tsx` :

```tsx
import { notFound, redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import { getProfil } from '@/lib/profil'
import { getCandidature } from '@/lib/candidature/lecture'
import CandidatureEditor from '@/components/candidature-editor'
import PageHeader from '@/components/page-header'

export default async function CandidaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: offre } = await supabase.from('offres').select(OFFRE_COLUMNS).eq('id', id).single()
  if (!offre) notFound()

  const [profil, candidature] = await Promise.all([
    getProfil(supabase, user.id),
    getCandidature(supabase, user.id, id),
  ])
  const profilComplet = Boolean(profil?.cv_url && profil?.lettre_url)
  const o = offre as OffreRow

  return (
    <section className="screen on">
      <PageHeader titre="Retour" />
      <div className="detail-scroll">
        <div className="detail-hero">
          <header className="detail-head">
            <div className="d-titletext">
              <h1>Candidater : {o.titre}</h1>
              <div className="d-emp">
                <b>{o.entreprise ?? 'Employeur non précisé'}</b>{o.ville ? ` · ${o.ville}` : ''}
              </div>
            </div>
          </header>
        </div>
        <div className="detail-wrap">
          <CandidatureEditor offre={o} profilComplet={profilComplet} candidatureInitiale={candidature} />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Ajouter les styles de l'écran candidature**

Dans `src/app/globals.css`, ajouter à la fin (styles sobres, cohérents avec l'existant `side-card` / `btn-primary`) :

```css
.cand-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; padding: 8px 0 40px; }
.cand-editor { display: flex; flex-direction: column; gap: 28px; padding-bottom: 48px; }
.cand-block { display: flex; flex-direction: column; gap: 8px; }
.cand-block h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 4px; }
.cand-block label { font-size: .8rem; font-weight: 600; color: var(--muted); margin-top: 6px; }
.cand-block input, .cand-block textarea {
  width: 100%; border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px;
  font-size: .92rem; color: var(--ink); background: #fff; outline: none; resize: vertical;
  font-family: inherit; transition: border-color .15s, box-shadow .15s;
}
.cand-block input:focus, .cand-block textarea:focus {
  border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft);
}
.cand-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.btn-ghost {
  border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 12px;
  padding: 10px 16px; font-size: .88rem; font-weight: 600; cursor: pointer; transition: background .15s;
}
.btn-ghost:hover { background: var(--accent-soft); }
.cand-ok { font-size: .85rem; font-weight: 600; color: var(--accent); }
.cand-err { font-size: .85rem; font-weight: 600; color: #e2565b; }
```

- [ ] **Step 7: Vérifier types + suite complète**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run
```
Attendu : tsc propre, suite verte.

- [ ] **Step 8: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(candidature): écran /offre/[id]/candidature + éditeur"
```

---

### Task 6: Vue imprimable PDF + activation du bouton sur la page offre

**Files:**
- Create: `src/components/lettre-imprimable.tsx`
- Modify: `src/components/candidature-editor.tsx` (bouton « Télécharger la lettre en PDF » + rendu `<LettreImprimable>`)
- Modify: `src/app/globals.css` (`@media print` + `.lettre-imprimable`)
- Modify: `src/components/offre-detail.tsx` (bouton actif vers la candidature)
- Test: `src/components/lettre-imprimable.test.tsx`

**Interfaces:**
- Consumes: `Candidature`/état `lettre` de l'éditeur (Task 5). `OffreRow` de `@/lib/offres/types`.
- Produces: `LettreImprimable({ lettre, offre }: { lettre: string; offre: OffreRow })`, une vue masquée à l'écran et visible à l'impression.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/components/lettre-imprimable.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import LettreImprimable from './lettre-imprimable'
import type { OffreRow } from '@/lib/offres/types'

const offre = {
  id: 'o1', source: 'x', source_id: 'x', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
  description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: 'Nantes',
  url_postuler: null, email_contact: null, date_publication: null,
} as OffreRow

test('rend le texte de la lettre dans un conteneur imprimable', () => {
  render(<LettreImprimable lettre={'Madame, Monsieur,\n\nJe me permets…'} offre={offre} />)
  const bloc = screen.getByTestId('lettre-imprimable')
  expect(bloc).toHaveClass('lettre-imprimable')
  expect(bloc.textContent).toContain('Je me permets')
})
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/lettre-imprimable.test.tsx
```
Attendu : FAIL (composant absent).

- [ ] **Step 3: Implémenter la vue imprimable**

Créer `src/components/lettre-imprimable.tsx` :

```tsx
import type { OffreRow } from '@/lib/offres/types'

export default function LettreImprimable({ lettre, offre }: { lettre: string; offre: OffreRow }) {
  return (
    <div className="lettre-imprimable" data-testid="lettre-imprimable" aria-hidden="true">
      <div className="li-head">
        <b>{offre.entreprise ?? ''}</b>
        {offre.ville ? <span>{offre.ville}</span> : null}
      </div>
      <div className="li-objet">Objet : candidature au poste de {offre.titre}</div>
      <div className="li-corps">{lettre}</div>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

```bash
cd /Users/mathys.jnt/job-compass && npx vitest run src/components/lettre-imprimable.test.tsx
```
Attendu : PASS.

- [ ] **Step 5: Brancher le composant et le bouton PDF dans l'éditeur**

Dans `src/components/candidature-editor.tsx` :

1. Ajouter l'import en tête : `import LettreImprimable from './lettre-imprimable'`.
2. Ajouter la fonction avant le `return` final :

```tsx
function telechargerPdf() {
  window.print()
}
```

3. Dans le bloc « Lettre de motivation », ajouter le bouton PDF à côté de « Copier la lettre » :

```tsx
<div className="cand-actions">
  <button type="button" className="btn-ghost" onClick={() => copier(lettre, 'La lettre')}>Copier la lettre</button>
  <button type="button" className="btn-ghost" onClick={telechargerPdf}>Télécharger la lettre en PDF</button>
</div>
```

4. Juste avant la fermeture `</div>` du `return` (racine `cand-editor`), rendre la vue imprimable avec le texte courant :

```tsx
<LettreImprimable lettre={lettre} offre={offre} />
```

- [ ] **Step 6: Ajouter les styles d'impression**

Dans `src/app/globals.css`, ajouter :

```css
/* Vue imprimable de la lettre : masquée à l'écran, visible à l'impression. */
.lettre-imprimable { display: none; }
.lettre-imprimable .li-head { display: flex; justify-content: space-between; margin-bottom: 28px; font-size: 12pt; }
.lettre-imprimable .li-objet { font-weight: 700; margin-bottom: 20px; font-size: 12pt; }
.lettre-imprimable .li-corps { white-space: pre-wrap; line-height: 1.6; font-size: 12pt; }

@media print {
  body * { visibility: hidden; }
  .lettre-imprimable, .lettre-imprimable * { visibility: visible; }
  .lettre-imprimable {
    display: block; position: absolute; inset: 0; margin: 0;
    padding: 24mm 20mm; color: #000; background: #fff; font-family: Georgia, "Times New Roman", serif;
  }
}
```

- [ ] **Step 7: Activer le bouton sur la page offre**

Dans `src/components/offre-detail.tsx` :

1. Ajouter l'import en tête : `import Link from 'next/link'`.
2. Remplacer la ligne du bouton désactivé (`<button type="button" className="btn-future" disabled>Candidater avec lettre IA <span className="soon">bientôt</span></button>`) par :

```tsx
<Link href={`/offre/${offre.id}/candidature`} className="btn-future">
  Candidater avec lettre IA
</Link>
```

- [ ] **Step 8: Vérifier types + suite complète + build**

```bash
cd /Users/mathys.jnt/job-compass && npx tsc --noEmit && npx vitest run && npx next build
```
Attendu : tsc propre, suite verte, build OK.

- [ ] **Step 9: Commit**

```bash
cd /Users/mathys.jnt/job-compass && git add -A && git commit -m "feat(candidature): lettre imprimable PDF + activation bouton page offre"
```

---

## Notes de fin de plan (hors tâches)

- **Migrations à appliquer sur Supabase distant après merge** (l'utilisateur les lance dans le SQL editor Supabase) : `0005_lettre_url.sql` puis `0006_candidatures.sql`.
- **Prérequis déjà satisfait :** `GEMINI_API_KEY` est dans `.env.local` (validée). Aucune inscription supplémentaire.
- **RLS candidatures :** le client serveur authentifié (`getServerClient`) respecte la RLS ; la policy `candidatures_self` garantit qu'un utilisateur ne lit/écrit que ses candidatures. Pas besoin du service client ici.
- **Lettre `lettre_base` (texte) :** colonne conservée en base, non supprimée, plus utilisée par l'UI ni la génération.
