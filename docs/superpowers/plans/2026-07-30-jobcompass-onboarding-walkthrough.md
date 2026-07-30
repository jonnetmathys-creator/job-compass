# Visite guidée première connexion · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une visite guidée « spotlight » multi-pages qui se déclenche à la première connexion et fait découvrir les fonctionnalités clés de JobCompass.

**Architecture:** Un moteur client (`OnboardingTour`) monté dans le layout lit un flag `profils.onboarding_termine`, pilote une liste ordonnée d'étapes (logique pure testable), et affiche un projecteur (`OnboardingSpotlight`, rendu en portail) qui met en évidence de vrais éléments repérés par des attributs `data-tour`. Le projecteur glisse en douceur d'un élément à l'autre. « Suivant » sur l'étape 1 lance une vraie recherche « Diététicien ».

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Supabase (@supabase/ssr), Vitest + @testing-library/react.

## Global Constraints

- Réponses/texte en français, jamais de tiret cadratin `—` (utiliser `:`, `,` ou `·`).
- Aucune clé secrète exposée au navigateur.
- Respecter `prefers-reduced-motion` (pas d'animation de déplacement si réduit).
- Chaque fichier de test DOIT commencer par `import { expect, test, vi } from 'vitest'` (les identifiants effectivement utilisés).
- Ne modifier le rendu des composants existants que par l'ajout d'attributs `data-tour` / `data-offre-id`.
- Commandes lancées depuis `/Users/mathys.jnt/job-compass` (préfixer `cd` si le shell repart du home).

---

### Task 1: Logique pure des étapes

**Files:**
- Create: `src/lib/onboarding/etapes.ts`
- Test: `src/lib/onboarding/etapes.test.ts`

**Interfaces:**
- Produces:
  - `type Etape = { id: string; page: RegExp; cible: string; titre: string; texte: string; placement: 'haut' | 'bas' | 'gauche' | 'droite'; action?: 'recherche' | 'offre' }`
  - `const ETAPES: Etape[]` (9 entrées)
  - `etapeSuivante(index: number, total: number): number`
  - `etapePrecedente(index: number): number`
  - `estDerniere(index: number, total: number): boolean`
  - `pageCorrespond(etape: Etape, pathname: string): boolean`

- [ ] **Step 1: Write the failing test**

`src/lib/onboarding/etapes.test.ts`:
```ts
import { expect, test } from 'vitest'
import { ETAPES, etapeSuivante, etapePrecedente, estDerniere, pageCorrespond } from './etapes'

test('ETAPES couvre le parcours en 9 étapes ordonnées', () => {
  expect(ETAPES).toHaveLength(9)
  expect(ETAPES[0].action).toBe('recherche')
  expect(ETAPES.find((e) => e.action === 'offre')?.id).toBe('cloche')
  expect(ETAPES.every((e) => e.cible && e.titre && e.texte)).toBe(true)
})

test('etapeSuivante avance et sature à la dernière', () => {
  expect(etapeSuivante(0, 9)).toBe(1)
  expect(etapeSuivante(8, 9)).toBe(8)
})

test('etapePrecedente recule et sature à zéro', () => {
  expect(etapePrecedente(3)).toBe(2)
  expect(etapePrecedente(0)).toBe(0)
})

test('estDerniere vraie seulement sur le dernier index', () => {
  expect(estDerniere(8, 9)).toBe(true)
  expect(estDerniere(7, 9)).toBe(false)
})

test('pageCorrespond confronte le pathname au motif de l’étape', () => {
  const accueil = ETAPES[0]
  expect(pageCorrespond(accueil, '/')).toBe(true)
  expect(pageCorrespond(accueil, '/recherche/abc')).toBe(false)
  const filtres = ETAPES.find((e) => e.id === 'filtres')!
  expect(pageCorrespond(filtres, '/recherche/xyz')).toBe(true)
  expect(pageCorrespond(filtres, '/')).toBe(false)
  const compte = ETAPES.find((e) => e.id === 'compte')!
  expect(pageCorrespond(compte, '/recherche/xyz')).toBe(true)
  expect(pageCorrespond(compte, '/offre/xyz')).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/onboarding/etapes.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write minimal implementation**

`src/lib/onboarding/etapes.ts`:
```ts
export type Etape = {
  id: string
  page: RegExp
  cible: string
  titre: string
  texte: string
  placement: 'haut' | 'bas' | 'gauche' | 'droite'
  action?: 'recherche' | 'offre'
}

// Parcours de la visite guidée (voir la spec). Les motifs `page` disent sur quelle
// route l'étape s'affiche ; `cible` est un sélecteur `data-tour` posé sur l'UI réelle.
export const ETAPES: Etape[] = [
  { id: 'recherche', page: /^\/$/, cible: '[data-tour="recherche"]', placement: 'bas', action: 'recherche',
    titre: 'Commence ici', texte: 'Tape le métier que tu cherches, puis clique Suivant pour voir un exemple de résultats.' },
  { id: 'filtres', page: /^\/recherche\//, cible: '[data-tour="filtres"]', placement: 'bas',
    titre: 'Affine tes résultats', texte: 'Filtre par lieu, distance et type de contrat.' },
  { id: 'liste', page: /^\/recherche\//, cible: '[data-tour="liste"]', placement: 'droite',
    titre: 'Tes offres', texte: 'Toutes les offres trouvées s’affichent ici, du plus récent au plus ancien.' },
  { id: 'carte', page: /^\/recherche\//, cible: '[data-tour="carte"]', placement: 'gauche',
    titre: 'Sur la carte', texte: 'Chaque pin est une offre : clique dessus pour l’ouvrir.' },
  { id: 'like', page: /^\/recherche\//, cible: '[data-tour="like"]', placement: 'droite',
    titre: 'Sauvegarde', texte: 'Un coup de cœur ? Garde l’offre pour la retrouver dans tes offres likées.' },
  { id: 'cloche', page: /^\/recherche\//, cible: '[data-tour="cloche"]', placement: 'gauche', action: 'offre',
    titre: 'Notifications', texte: 'Nouvelles offres et rappels de candidature arrivent dans cette cloche. Clique Suivant pour ouvrir une offre.' },
  { id: 'postuler', page: /^\/offre\//, cible: '[data-tour="postuler"]', placement: 'gauche',
    titre: 'Postule', texte: 'Au retour sur l’onglet, on te demande si c’est fait pour remplir ton suivi.' },
  { id: 'candidature-ia', page: /^\/offre\//, cible: '[data-tour="candidature-ia"]', placement: 'gauche',
    titre: 'Candidature IA', texte: 'Laisse l’IA rédiger un mail et une lettre personnalisés à partir de ton CV.' },
  { id: 'compte', page: /^\/(recherche|offre)\//, cible: '[data-tour="compte"]', placement: 'gauche',
    titre: 'Ton espace', texte: 'Profil, offres likées et suivi de tes candidatures sont ici. Bonne chasse !' },
]

export function etapeSuivante(index: number, total: number): number {
  return Math.min(index + 1, total - 1)
}

export function etapePrecedente(index: number): number {
  return Math.max(index - 1, 0)
}

export function estDerniere(index: number, total: number): boolean {
  return index === total - 1
}

export function pageCorrespond(etape: Etape, pathname: string): boolean {
  return etape.page.test(pathname)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/onboarding/etapes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding/etapes.ts src/lib/onboarding/etapes.test.ts
git commit -m "feat(onboarding): étapes de la visite guidée (logique pure)"
```

---

### Task 2: Migration + lecture/écriture du flag

**Files:**
- Create: `supabase/migrations/0011_onboarding.sql`
- Create: `src/lib/onboarding/lecture.ts`
- Create: `src/lib/onboarding/actions.ts`
- Test: `src/lib/onboarding/lecture.test.ts`

**Interfaces:**
- Consumes: `getServerClient` from `@/lib/supabase/server`.
- Produces:
  - `estOnboardingTermine(client: SupabaseClient, userId: string): Promise<boolean>`
  - `terminerOnboarding(): Promise<void>` (server action)
  - `reinitialiserOnboarding(): Promise<void>` (server action)

- [ ] **Step 1: Write the migration**

`supabase/migrations/0011_onboarding.sql`:
```sql
-- Flag de première connexion : la visite guidée ne se déclenche que tant qu'il est faux.
alter table public.profils add column if not exists onboarding_termine boolean not null default false;
```

- [ ] **Step 2: Write the failing test**

`src/lib/onboarding/lecture.test.ts`:
```ts
import { expect, test, vi } from 'vitest'
import { estOnboardingTermine } from './lecture'

function clientAvec(row: { onboarding_termine: boolean } | null) {
  return {
    from: vi.fn((..._args: unknown[]) => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }),
    })),
  } as never
}

test('renvoie false quand aucune ligne profil', async () => {
  expect(await estOnboardingTermine(clientAvec(null), 'u1')).toBe(false)
})

test('renvoie la valeur du flag quand la ligne existe', async () => {
  expect(await estOnboardingTermine(clientAvec({ onboarding_termine: true }), 'u1')).toBe(true)
  expect(await estOnboardingTermine(clientAvec({ onboarding_termine: false }), 'u1')).toBe(false)
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/onboarding/lecture.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 4: Write lecture.ts**

`src/lib/onboarding/lecture.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export async function estOnboardingTermine(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await client
    .from('profils').select('onboarding_termine').eq('user_id', userId).maybeSingle()
  return data?.onboarding_termine ?? false
}
```

- [ ] **Step 5: Write actions.ts**

`src/lib/onboarding/actions.ts`:
```ts
'use server'

import { getServerClient } from '@/lib/supabase/server'

async function definirFlag(valeur: boolean): Promise<void> {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // upsert : crée la ligne profil si elle n'existe pas encore.
  await supabase.from('profils').upsert(
    { user_id: user.id, onboarding_termine: valeur },
    { onConflict: 'user_id' },
  )
}

export async function terminerOnboarding(): Promise<void> {
  await definirFlag(true)
}

export async function reinitialiserOnboarding(): Promise<void> {
  await definirFlag(false)
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/onboarding/lecture.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0011_onboarding.sql src/lib/onboarding/lecture.ts src/lib/onboarding/actions.ts src/lib/onboarding/lecture.test.ts
git commit -m "feat(onboarding): migration flag + lecture/écriture onboarding_termine"
```

---

### Task 3: Composant projecteur (spotlight)

**Files:**
- Create: `src/components/onboarding-spotlight.tsx`
- Modify: `src/app/globals.css` (ajout du bloc de styles à la fin)
- Test: `src/components/onboarding-spotlight.test.tsx`

**Interfaces:**
- Consumes: `type Etape` from `@/lib/onboarding/etapes`.
- Produces:
  - `type Rect = { top: number; left: number; width: number; height: number }`
  - default `OnboardingSpotlight(props: { etape: Etape; rect: Rect | null; index: number; total: number; suivantLabel: string; onPrecedent: () => void; onSuivant: () => void; onPasser: () => void })`

- [ ] **Step 1: Write the failing test**

`src/components/onboarding-spotlight.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import OnboardingSpotlight, { type Rect } from './onboarding-spotlight'
import { ETAPES } from '@/lib/onboarding/etapes'

const rect: Rect = { top: 100, left: 100, width: 200, height: 40 }

test('affiche le titre, le texte et les boutons de l’étape', () => {
  render(<OnboardingSpotlight etape={ETAPES[1]} rect={rect} index={1} total={9} suivantLabel="Suivant"
    onPrecedent={() => {}} onSuivant={() => {}} onPasser={() => {}} />)
  expect(screen.getByText('Affine tes résultats')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Suivant' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Passer' })).toBeInTheDocument()
})

test('les boutons déclenchent les callbacks', () => {
  const onSuivant = vi.fn()
  const onPasser = vi.fn()
  render(<OnboardingSpotlight etape={ETAPES[1]} rect={rect} index={1} total={9} suivantLabel="Suivant"
    onPrecedent={() => {}} onSuivant={onSuivant} onPasser={onPasser} />)
  fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
  fireEvent.click(screen.getByRole('button', { name: 'Passer' }))
  expect(onSuivant).toHaveBeenCalledOnce()
  expect(onPasser).toHaveBeenCalledOnce()
})

test('en pause (rect null) propose seulement de passer', () => {
  render(<OnboardingSpotlight etape={ETAPES[6]} rect={null} index={6} total={9} suivantLabel="Suivant"
    onPrecedent={() => {}} onSuivant={() => {}} onPasser={() => {}} />)
  expect(screen.getByRole('button', { name: 'Passer le tutoriel' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/onboarding-spotlight.test.tsx`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write the component**

`src/components/onboarding-spotlight.tsx`:
```tsx
'use client'
import { createPortal } from 'react-dom'
import type { Etape } from '@/lib/onboarding/etapes'

export type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6 // marge du halo autour de la cible

// Position de la bulle selon le placement demandé, calée sur le rectangle de la cible.
function styleBulle(rect: Rect, placement: Etape['placement']): React.CSSProperties {
  const g = 16
  switch (placement) {
    case 'haut': return { top: rect.top - g, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' }
    case 'gauche': return { top: rect.top + rect.height / 2, left: rect.left - g, transform: 'translate(-100%, -50%)' }
    case 'droite': return { top: rect.top + rect.height / 2, left: rect.left + rect.width + g, transform: 'translate(0, -50%)' }
    default: return { top: rect.top + rect.height + g, left: rect.left + rect.width / 2, transform: 'translate(-50%, 0)' }
  }
}

export default function OnboardingSpotlight(props: {
  etape: Etape; rect: Rect | null; index: number; total: number; suivantLabel: string
  onPrecedent: () => void; onSuivant: () => void; onPasser: () => void
}) {
  if (typeof document === 'undefined') return null
  const { rect, etape } = props

  // Pause : la cible n'est pas (encore) sur la page. On garde une sortie possible.
  if (!rect) {
    return createPortal(
      <div className="tour-pause">
        <span>Reprise du tutoriel…</span>
        <button type="button" onClick={props.onPasser}>Passer le tutoriel</button>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div className="tour-couche" role="dialog" aria-modal="true" aria-label={etape.titre}>
      <div className="tour-trou" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
      <div className="tour-bulle" style={styleBulle(rect, etape.placement)}>
        <div className="tour-bulle-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
        <h4 className="tour-bulle-titre">{etape.titre}</h4>
        <p className="tour-bulle-texte">{etape.texte}</p>
        <div className="tour-points" aria-hidden>
          {Array.from({ length: props.total }, (_, i) => <span key={i} className={i === props.index ? 'on' : ''} />)}
        </div>
        <div className="tour-actions">
          <button type="button" className="tour-passer" onClick={props.onPasser}>Passer</button>
          <div className="tour-nav">
            {props.index > 0 && <button type="button" className="tour-prec" onClick={props.onPrecedent}>Précédent</button>}
            <button type="button" className="tour-suiv" onClick={props.onSuivant}>{props.suivantLabel}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 4: Append styles to `src/app/globals.css`**

```css

/* ── Visite guidée (onboarding spotlight) ───────────────────────────── */
.tour-couche { position: fixed; inset: 0; z-index: 3000; pointer-events: none; }
.tour-trou {
  position: fixed; border-radius: 12px; pointer-events: none;
  box-shadow: 0 0 0 9999px rgba(16, 20, 17, .62), 0 0 0 3px var(--accent), 0 0 22px 4px rgba(46, 158, 91, .5);
  transition: top .45s cubic-bezier(.4, 0, .2, 1), left .45s cubic-bezier(.4, 0, .2, 1), width .45s cubic-bezier(.4, 0, .2, 1), height .45s cubic-bezier(.4, 0, .2, 1);
}
.tour-bulle {
  position: fixed; pointer-events: auto; width: 300px; max-width: calc(100vw - 32px);
  background: #fff; border-radius: 18px; padding: 20px; box-shadow: 0 20px 50px rgba(16, 20, 17, .3);
  animation: tour-pop .3s cubic-bezier(.2, .8, .3, 1.2);
  transition: top .45s cubic-bezier(.4, 0, .2, 1), left .45s cubic-bezier(.4, 0, .2, 1);
}
@keyframes tour-pop { from { opacity: 0; transform-origin: center; } to { opacity: 1; } }
.tour-bulle-ico { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; color: var(--accent); background: var(--accent-soft); margin-bottom: 12px; }
.tour-bulle-ico svg { width: 20px; height: 20px; }
.tour-bulle-titre { font-size: 1.02rem; font-weight: 800; color: var(--ink); }
.tour-bulle-texte { font-size: .87rem; color: var(--muted); line-height: 1.45; margin: 6px 0 14px; }
.tour-points { display: flex; gap: 6px; margin-bottom: 16px; }
.tour-points span { width: 6px; height: 6px; border-radius: 50%; background: var(--line); transition: background .2s, width .2s; }
.tour-points span.on { width: 18px; border-radius: 3px; background: var(--accent); }
.tour-actions { display: flex; align-items: center; justify-content: space-between; }
.tour-nav { display: flex; gap: 8px; }
.tour-passer { background: none; border: 0; color: var(--muted); font-size: .85rem; cursor: pointer; font-family: inherit; }
.tour-prec { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 8px 14px; font-size: .85rem; font-weight: 600; cursor: pointer; font-family: inherit; color: var(--ink); }
.tour-suiv { background: var(--accent); color: #fff; border: 0; border-radius: 10px; padding: 8px 16px; font-size: .85rem; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 4px 14px rgba(46, 158, 91, .35); }
.tour-suiv:hover { background: var(--accent-dark); }
.tour-pause {
  position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); z-index: 3000; pointer-events: auto;
  display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid var(--line);
  border-radius: 999px; padding: 10px 12px 10px 20px; box-shadow: 0 14px 40px rgba(16, 20, 17, .22); font-size: .85rem; color: var(--muted);
}
.tour-pause button { background: var(--accent-soft); color: var(--accent-dark); border: 0; border-radius: 999px; padding: 8px 14px; font-size: .82rem; font-weight: 700; cursor: pointer; font-family: inherit; }
@media (prefers-reduced-motion: reduce) {
  .tour-trou, .tour-bulle { transition: none; animation: none; }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/onboarding-spotlight.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding-spotlight.tsx src/components/onboarding-spotlight.test.tsx src/app/globals.css
git commit -m "feat(onboarding): composant projecteur + styles (déplacement fluide, bulle soignée)"
```

---

### Task 4: Moteur de visite + montage layout

**Files:**
- Create: `src/components/onboarding-tour.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/components/onboarding-tour.test.tsx`

**Interfaces:**
- Consumes: `ETAPES`, `etapeSuivante`, `etapePrecedente`, `estDerniere`, `pageCorrespond` (`@/lib/onboarding/etapes`); `terminerOnboarding` (`@/lib/onboarding/actions`); `estOnboardingTermine` (`@/lib/onboarding/lecture`); `lancerRecherche` (`@/lib/recherche/actions`); `getBrowserClient` (`@/lib/supabase/client`); `OnboardingSpotlight`, `type Rect` (`./onboarding-spotlight`); `LoadingOverlay` (`./loading-overlay`).
- Produces: default `OnboardingTour()` (aucune prop).

- [ ] **Step 1: Write the failing test**

`src/components/onboarding-tour.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import OnboardingTour from './onboarding-tour'

const { flag } = vi.hoisted(() => ({ flag: { termine: false } }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))
vi.mock('@/lib/onboarding/lecture', () => ({
  estOnboardingTermine: vi.fn(async () => flag.termine),
}))
vi.mock('@/lib/onboarding/actions', () => ({ terminerOnboarding: vi.fn() }))
vi.mock('@/lib/recherche/actions', () => ({ lancerRecherche: vi.fn() }))

test('flag terminé -> aucune visite affichée', async () => {
  flag.termine = true
  localStorage.clear(); document.body.innerHTML = ''
  render(<OnboardingTour />)
  await waitFor(() => {}) // laisse l'effet asynchrone s'exécuter
  // le projecteur est rendu en portail dans document.body : on interroge tout le document
  expect(screen.queryByText('Commence ici')).toBeNull()
})

test('flag non terminé -> démarre sur la première étape', async () => {
  flag.termine = false
  localStorage.clear()
  // la cible de l'étape 1 doit exister pour que la bulle (et non la pause) s'affiche
  document.body.innerHTML = '<form data-tour="recherche"></form>'
  render(<OnboardingTour />)
  await waitFor(() => expect(screen.getByText('Commence ici')).toBeInTheDocument())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/onboarding-tour.test.tsx`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write the engine**

`src/components/onboarding-tour.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'
import { estOnboardingTermine } from '@/lib/onboarding/lecture'
import { terminerOnboarding } from '@/lib/onboarding/actions'
import { lancerRecherche } from '@/lib/recherche/actions'
import { ETAPES, etapeSuivante, etapePrecedente, estDerniere, pageCorrespond } from '@/lib/onboarding/etapes'
import OnboardingSpotlight, { type Rect } from './onboarding-spotlight'
import LoadingOverlay from './loading-overlay'

const CLE_INDEX = 'jc_tour_index'
const CLE_RELANCE = 'jc_tour_relance'
const CHARGEMENT_MSGS = ['Exploration des offres…', 'Analyse des postes…', 'Localisation sur la carte…', 'On y est presque…']

export default function OnboardingTour() {
  const pathname = usePathname()
  const router = useRouter()
  const [actif, setActif] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [chargement, setChargement] = useState(false)
  const [, demarrerTransition] = useTransition()
  const verifie = useRef(false)

  // Démarrage : première page hors login/signup, on lit le flag (ou une relance locale).
  useEffect(() => {
    if (verifie.current) return
    if (pathname === '/login' || pathname === '/signup') return
    verifie.current = true
    let annule = false
    const client = getBrowserClient()
    ;(async () => {
      const relance = typeof window !== 'undefined' && localStorage.getItem(CLE_RELANCE) === '1'
      const { data: { user } } = await client.auth.getUser()
      if (!user || annule) return
      const termine = await estOnboardingTermine(client, user.id)
      if (annule) return
      if (relance || !termine) {
        const brut = Number(localStorage.getItem(CLE_INDEX) ?? '0')
        const idx = relance || !Number.isFinite(brut) ? 0 : Math.min(Math.max(brut, 0), ETAPES.length - 1)
        localStorage.removeItem(CLE_RELANCE)
        setIndex(idx)
        setActif(true)
      }
    })()
    return () => { annule = true }
  }, [pathname])

  // Persiste l'index pour survivre aux navigations/reloads en cours de visite.
  useEffect(() => { if (actif) localStorage.setItem(CLE_INDEX, String(index)) }, [actif, index])

  // Localise la cible de l'étape courante et suit ses mouvements (scroll/resize).
  useEffect(() => {
    if (!actif) { setRect(null); return }
    const etape = ETAPES[index]
    if (!pageCorrespond(etape, pathname)) { setRect(null); return }
    let annule = false
    let essais = 0
    const maj = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    const trouver = () => {
      if (annule) return
      const el = document.querySelector(etape.cible) as HTMLElement | null
      if (el) {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }) } catch { /* jsdom */ }
        maj(el); return
      }
      if (essais++ < 20) setTimeout(trouver, 100) // ~2 s puis pause
    }
    const suivre = () => {
      const el = document.querySelector(etape.cible) as HTMLElement | null
      if (el) maj(el)
    }
    trouver()
    window.addEventListener('scroll', suivre, true)
    window.addEventListener('resize', suivre)
    return () => { annule = true; window.removeEventListener('scroll', suivre, true); window.removeEventListener('resize', suivre) }
  }, [actif, index, pathname])

  const finir = useCallback(() => {
    setActif(false); setRect(null); setChargement(false)
    if (typeof window !== 'undefined') localStorage.removeItem(CLE_INDEX)
    terminerOnboarding().catch(() => {})
  }, [])

  const suivant = useCallback(() => {
    const etape = ETAPES[index]
    if (estDerniere(index, ETAPES.length)) { finir(); return }
    if (etape.action === 'recherche') {
      setIndex((i) => etapeSuivante(i, ETAPES.length))
      setChargement(true)
      demarrerTransition(() => { lancerRecherche('Diététicien') })
      return
    }
    if (etape.action === 'offre') {
      const carte = document.querySelector('[data-offre-id]') as HTMLElement | null
      const id = carte?.dataset.offreId
      if (id) { setIndex((i) => etapeSuivante(i, ETAPES.length)); router.push(`/offre/${id}`) }
      else { setIndex(ETAPES.length - 1) } // aucune offre : saute à l'étape « compte »
      return
    }
    setIndex((i) => etapeSuivante(i, ETAPES.length))
  }, [index, finir, router])

  const precedent = useCallback(() => setIndex((i) => etapePrecedente(i)), [])

  if (!actif || pathname === '/login' || pathname === '/signup') return null
  return (
    <>
      {chargement && <LoadingOverlay messages={CHARGEMENT_MSGS} />}
      <OnboardingSpotlight
        etape={ETAPES[index]} rect={rect} index={index} total={ETAPES.length}
        suivantLabel={estDerniere(index, ETAPES.length) ? 'Terminer' : 'Suivant'}
        onPrecedent={precedent} onSuivant={suivant} onPasser={finir}
      />
    </>
  )
}
```

- [ ] **Step 4: Mount in layout**

Modify `src/app/layout.tsx` : importer et rendre `OnboardingTour` juste après `{children}`.
```tsx
import OnboardingTour from '@/components/onboarding-tour'
```
```tsx
        {children}
        <OnboardingTour />
      </body>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/onboarding-tour.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding-tour.tsx src/components/onboarding-tour.test.tsx src/app/layout.tsx
git commit -m "feat(onboarding): moteur de visite guidée + montage layout"
```

---

### Task 5: Cibles data-tour sur l'UI existante

**Files:**
- Modify: `src/components/search-bar.tsx:52` (form `searchbar`)
- Modify: `src/components/filtres-bar.tsx:51` (bouton `filtres-btn`)
- Modify: `src/components/resultats-shell.tsx:44,49` (`list-pane`, `map-pane`)
- Modify: `src/components/like-bouton.tsx` (prop `dataTour`)
- Modify: `src/components/offre-card.tsx:11,14` (`data-offre-id`, transmission `dataTour`)
- Modify: `src/components/cloche-notifs.tsx:41` (bouton cloche)
- Modify: `src/components/postuler-zone.tsx` (lien + bouton Postuler)
- Modify: `src/components/offre-detail.tsx:154` (lien Candidater IA)
- Modify: `src/components/compte-menu.tsx:38` (bouton avatar)

**Interfaces:**
- Consumes: rien de neuf. Ajoute des attributs DOM `data-tour="..."` et `data-offre-id`.
- Produces: sélecteurs stables pour `ETAPES` (`[data-tour="recherche|filtres|liste|carte|like|cloche|postuler|candidature-ia|compte"]`, `[data-offre-id]`).

- [ ] **Step 1: search-bar.tsx** — ajouter `data-tour="recherche"` à la balise `<form className="searchbar" ...>`.

- [ ] **Step 2: filtres-bar.tsx** — ajouter `data-tour="filtres"` au `<button ... className={\`filtres-btn...\`}>`.

- [ ] **Step 3: resultats-shell.tsx** — ajouter `data-tour="liste"` au `<div className="list-pane" id="list">` et `data-tour="carte"` au `<div className="map-pane">`.

- [ ] **Step 4: like-bouton.tsx** — accepter une prop optionnelle et l'appliquer :
```tsx
export default function LikeBouton({ liked, onToggle, dataTour }: { liked: boolean; onToggle: () => void; dataTour?: string }) {
```
et sur le `<button ...>` ajouter `data-tour={dataTour}`.

- [ ] **Step 5: offre-card.tsx** — ajouter `data-offre-id={offre.id}` au `<div className={\`card...\`}>` et transmettre la cible au cœur : `<LikeBouton liked={props.liked} onToggle={props.onToggleLike} dataTour="like" />`. (`querySelector` renverra le premier cœur, donc la première carte.)

- [ ] **Step 6: cloche-notifs.tsx** — ajouter `data-tour="cloche"` au `<button className={\`cloche-btn...\`}>`.

- [ ] **Step 7: postuler-zone.tsx** — ajouter `data-tour="postuler"` au lien `<a className={boutonClass} ...>` et au `<button type="button" className={boutonClass} onClick={armer}>`. (Ne pas le mettre sur l'état « déjà postulé » ni sur le bouton désactivé.)

- [ ] **Step 8: offre-detail.tsx** — ajouter `data-tour="candidature-ia"` au `<Link href={\`/offre/${offre.id}/candidature\`} className="btn-ia">`.

- [ ] **Step 9: compte-menu.tsx** — ajouter `data-tour="compte"` au `<button className="avatar-btn" ...>`.

- [ ] **Step 10: Run the full suite + build**

Run: `npx vitest run && npx next build`
Expected: tous les tests passent, build OK (les attributs data-* ne changent pas le rendu testé).

- [ ] **Step 11: Commit**

```bash
git add src/components/search-bar.tsx src/components/filtres-bar.tsx src/components/resultats-shell.tsx src/components/like-bouton.tsx src/components/offre-card.tsx src/components/cloche-notifs.tsx src/components/postuler-zone.tsx src/components/offre-detail.tsx src/components/compte-menu.tsx
git commit -m "feat(onboarding): cibles data-tour sur l'UI (recherche, filtres, carte, like, cloche, postuler, IA, compte)"
```

---

### Task 6: Bouton « Revoir le tutoriel » dans le profil

**Files:**
- Create: `src/components/onboarding-rejouer.tsx`
- Modify: `src/app/profil/page.tsx`
- Test: `src/components/onboarding-rejouer.test.tsx`

**Interfaces:**
- Consumes: `reinitialiserOnboarding` (`@/lib/onboarding/actions`).
- Produces: default `OnboardingRejouer()` (aucune prop) — pose `jc_tour_relance=1`, remet `jc_tour_index=0`, appelle `reinitialiserOnboarding()`, redirige vers `/`.

- [ ] **Step 1: Write the failing test**

`src/components/onboarding-rejouer.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import OnboardingRejouer from './onboarding-rejouer'

const { reinit } = vi.hoisted(() => ({ reinit: vi.fn() }))
vi.mock('@/lib/onboarding/actions', () => ({ reinitialiserOnboarding: reinit }))

test('relance : pose les clés localStorage et appelle la réinitialisation', async () => {
  const assign = vi.fn()
  Object.defineProperty(window, 'location', { value: { assign, href: '' }, writable: true })
  render(<OnboardingRejouer />)
  fireEvent.click(screen.getByRole('button', { name: /Revoir le tutoriel/i }))
  expect(localStorage.getItem('jc_tour_relance')).toBe('1')
  expect(localStorage.getItem('jc_tour_index')).toBe('0')
  await waitFor(() => expect(reinit).toHaveBeenCalledOnce())
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/onboarding-rejouer.test.tsx`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write the component**

`src/components/onboarding-rejouer.tsx`:
```tsx
'use client'
import { useTransition } from 'react'
import { reinitialiserOnboarding } from '@/lib/onboarding/actions'

export default function OnboardingRejouer() {
  const [pending, startTransition] = useTransition()

  function rejouer() {
    localStorage.setItem('jc_tour_relance', '1')
    localStorage.setItem('jc_tour_index', '0')
    startTransition(async () => {
      try { await reinitialiserOnboarding() } catch { /* non bloquant */ }
      window.location.assign('/')
    })
  }

  return (
    <button type="button" className="profil-tuto" onClick={rejouer} disabled={pending}>
      <span className="profil-tuto-ico">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
      </span>
      <span className="profil-tuto-txt"><b>Revoir le tutoriel</b><small>Relance la visite guidée de l’app</small></span>
    </button>
  )
}
```

- [ ] **Step 4: Append styles to `src/app/globals.css`**

```css

/* ── Bouton « Revoir le tutoriel » (profil) ─────────────────────────── */
.profil-tuto { display: flex; align-items: center; gap: 13px; width: 100%; text-align: left; padding: 12px 2px; background: none; border: 0; cursor: pointer; font-family: inherit; color: var(--ink); }
.profil-tuto:disabled { opacity: .6; cursor: default; }
.profil-tuto-ico { flex: none; width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; color: var(--accent); background: var(--accent-soft); }
.profil-tuto-ico svg { width: 22px; height: 22px; }
.profil-tuto-txt { display: flex; flex-direction: column; gap: 2px; }
.profil-tuto-txt b { font-size: .95rem; font-weight: 700; }
.profil-tuto-txt small { font-size: .8rem; color: var(--muted); }
```

- [ ] **Step 5: Wire into profil page**

Modify `src/app/profil/page.tsx` : importer `OnboardingRejouer` et l'ajouter dans la carte des alertes (ou juste après). Concrètement, dans la `<div className="side-card" style={{ padding: '20px 22px', marginBottom: 20 }}>` qui contient `<AlertesProfil .../>`, ajouter sous celui-ci :
```tsx
import OnboardingRejouer from '@/components/onboarding-rejouer'
```
```tsx
            <AlertesProfil alertes={alertes} />
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 6 }}>
              <OnboardingRejouer />
            </div>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/components/onboarding-rejouer.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 7: Full suite + build + commit**

```bash
npx vitest run && npx next build
git add src/components/onboarding-rejouer.tsx src/components/onboarding-rejouer.test.tsx src/app/profil/page.tsx src/app/globals.css
git commit -m "feat(onboarding): bouton Revoir le tutoriel dans le profil"
```

---

## Notes d'exécution

- Migration `0011_onboarding.sql` à appliquer sur Supabase (SQL Editor) avant test manuel : c'est un simple `add column ... default false`, sans données à migrer.
- Test manuel de bout en bout : sur un compte neuf (ou après « Revoir le tutoriel »), la visite doit démarrer, le projecteur glisser d'un élément à l'autre, « Suivant » sur l'accueil lancer une recherche « Diététicien », puis dérouler jusqu'à l'étape « compte » et écrire le flag (pas de redéclenchement au reload).
