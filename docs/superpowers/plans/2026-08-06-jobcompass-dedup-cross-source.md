# Déduplication cross-source · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** n'afficher qu'une carte par offre quand plusieurs sources remontent le même poste, avec un badge "Aussi sur ...".

**Architecture :** fonction pure `dedupeAffichage` (empreinte titre+ville+entreprise normalisée), appliquée dans la page résultats. Le champ `plateformes` est propagé jusqu'à la carte. Aucune migration.

**Tech Stack :** TypeScript, Next.js 16, Vitest.

## Global Constraints

- Jamais de tiret cadratin. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- Logique en fonction pure testable ; la page ne fait que l'appeler.
- Commits terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commits locaux uniquement.

## File Structure

- `src/lib/offres/dedup-affichage.ts` (créé) : `dedupeAffichage`, type `OffreAffichee`.
- `src/lib/offres/dedup-affichage.test.ts` (créé) : tests.
- `src/app/recherche/[id]/page.tsx` (modifié) : appel du dédup.
- `src/components/resultats-shell.tsx`, `offre-liste.tsx`, `offre-card.tsx` (modifiés) : type `OffreAffichee` + badge.
- `src/app/globals.css` (modifié) : style `.offre-plateformes`.

---

### Task 1: Fonction de déduplication

**Files:**
- Create: `src/lib/offres/dedup-affichage.ts`
- Test: `src/lib/offres/dedup-affichage.test.ts`

**Interfaces:**
- Consumes : `OffreRow` depuis `./types`.
- Produces : `type OffreAffichee = OffreRow & { plateformes: string[] }` ; `dedupeAffichage(offres: OffreRow[]): OffreAffichee[]`.

- [ ] **Step 1: Tests (échouent d'abord)**

```ts
import { expect, test } from 'vitest'
import { dedupeAffichage } from './dedup-affichage'
import type { OffreRow } from './types'

function o(p: Partial<OffreRow> & { id: string; source: string }): OffreRow {
  return {
    id: p.id, source: p.source, source_id: p.id, titre: p.titre ?? 'Diététicien H/F',
    entreprise: p.entreprise ?? 'CH Le Mans', entreprise_logo: null, description: p.description ?? null,
    contrat: null, salaire: null, latitude: p.latitude ?? null, longitude: p.longitude ?? null,
    ville: p.ville ?? 'Le Mans', url_postuler: null, email_contact: null,
    date_publication: p.date_publication ?? null,
  }
}

test('fusionne deux sources du même poste et liste les plateformes', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail' }),
    o({ id: '2', source: 'staffsante' }),
  ])
  expect(out).toHaveLength(1)
  expect(out[0].plateformes).toEqual(['France Travail', 'StaffSanté'])
})

test('normalise le titre (H/F, casse, ponctuation)', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail', titre: 'Diététicien H/F' }),
    o({ id: '2', source: 'adzuna', titre: 'DIETETICIEN (H/F)' }),
  ])
  expect(out).toHaveLength(1)
})

test('ne fusionne pas des villes différentes', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'france_travail', ville: 'Le Mans' }),
    o({ id: '2', source: 'staffsante', ville: 'Nantes' }),
  ])
  expect(out).toHaveLength(2)
})

test('garde la représentante avec coordonnées', () => {
  const out = dedupeAffichage([
    o({ id: 'sans', source: 'france_travail', latitude: null, longitude: null }),
    o({ id: 'avec', source: 'staffsante', latitude: 48, longitude: 0 }),
  ])
  expect(out).toHaveLength(1)
  expect(out[0].id).toBe('avec')
  expect(out[0].plateformes[0]).toBe('StaffSanté') // source de la représentante en tête
})

test('une entreprise nulle ne fusionne pas avec une entreprise renseignée', () => {
  const out = dedupeAffichage([
    o({ id: '1', source: 'afdn', entreprise: null }),
    o({ id: '2', source: 'france_travail', entreprise: 'CH Le Mans' }),
  ])
  expect(out).toHaveLength(2)
})

test('préserve l’ordre d’entrée des représentantes', () => {
  const out = dedupeAffichage([
    o({ id: 'a', source: 'france_travail', titre: 'Poste A', ville: 'Nantes' }),
    o({ id: 'b', source: 'france_travail', titre: 'Poste B', ville: 'Rennes' }),
  ])
  expect(out.map((x) => x.id)).toEqual(['a', 'b'])
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run src/lib/offres/dedup-affichage.test.ts`
Expected: FAIL (module absent).

- [ ] **Step 3: Implémenter**

```ts
import type { OffreRow } from './types'

const LIBELLES_SOURCE: Record<string, string> = {
  france_travail: 'France Travail',
  adzuna: 'Adzuna',
  afdn: 'AFDN',
  staffsante: 'StaffSanté',
  jooble: 'Jooble',
  manuelle: 'Ajout manuel',
}

export type OffreAffichee = OffreRow & { plateformes: string[] }

function norm(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .replace(/[()]/g, ' ')
    .replace(/\b[hf]\s*[\/\-]\s*[hf]\b/g, ' ')         // h/f, f/h, h-f
    .replace(/[^a-z0-9\s]/g, ' ')                       // ponctuation
    .replace(/\s+/g, ' ')
    .trim()
}

function empreinte(o: OffreRow): string {
  return `${norm(o.titre)}|${norm(o.ville)}|${norm(o.entreprise)}`
}

// b est-elle strictement plus complète que a ? (coords > description > date récente)
function plusComplete(a: OffreRow, b: OffreRow): boolean {
  const coordA = a.latitude != null && a.longitude != null
  const coordB = b.latitude != null && b.longitude != null
  if (coordB !== coordA) return coordB
  const descA = !!a.description, descB = !!b.description
  if (descB !== descA) return descB
  const dA = a.date_publication ? Date.parse(a.date_publication) : -Infinity
  const dB = b.date_publication ? Date.parse(b.date_publication) : -Infinity
  return dB > dA
}

export function dedupeAffichage(offres: OffreRow[]): OffreAffichee[] {
  const groupes = new Map<string, { rep: OffreRow; sources: string[] }>()
  const ordre: string[] = []
  for (const o of offres) {
    const cle = empreinte(o)
    const g = groupes.get(cle)
    if (!g) {
      groupes.set(cle, { rep: o, sources: [o.source] })
      ordre.push(cle)
    } else {
      if (!g.sources.includes(o.source)) g.sources.push(o.source)
      if (plusComplete(g.rep, o)) g.rep = o
    }
  }
  const libelle = (s: string) => LIBELLES_SOURCE[s] ?? s
  return ordre.map((cle) => {
    const g = groupes.get(cle)!
    const plateformes = [
      libelle(g.rep.source),
      ...g.sources.filter((s) => s !== g.rep.source).map(libelle),
    ]
    return { ...g.rep, plateformes: [...new Set(plateformes)] }
  })
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run src/lib/offres/dedup-affichage.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/offres/dedup-affichage.ts src/lib/offres/dedup-affichage.test.ts
git commit -m "feat(offres): déduplication cross-source à l'affichage (empreinte titre+ville+entreprise)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Intégration et badge "Aussi sur ..."

**Files:**
- Modify: `src/app/recherche/[id]/page.tsx`, `src/components/resultats-shell.tsx`, `src/components/offre-liste.tsx`, `src/components/offre-card.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes : `dedupeAffichage`, `OffreAffichee` (Task 1).

- [ ] **Step 1: Appliquer le dédup dans la page résultats**

Dans `src/app/recherche/[id]/page.tsx`, importer `dedupeAffichage` et envelopper le calcul des offres :

```ts
import { dedupeAffichage } from '@/lib/offres/dedup-affichage'
```

Remplacer le bloc `const offres = ...` par :

```ts
  const offres = dedupeAffichage(
    recherche.latitude != null && recherche.longitude != null && recherche.rayon_km != null
      ? filtrerDansRayon(offresBrutes, { lat: recherche.latitude, lng: recherche.longitude }, recherche.rayon_km)
      : offresBrutes,
  )
```

- [ ] **Step 2: Propager le type `OffreAffichee`**

Dans `src/components/resultats-shell.tsx`, remplacer le type des offres reçues (`offres: OffreRow[]`) par `OffreAffichee[]` et importer le type :

```ts
import type { OffreAffichee } from '@/lib/offres/dedup-affichage'
```
(changer `offres: OffreRow[]` → `offres: OffreAffichee[]` dans les props).

Dans `src/components/offre-liste.tsx`, faire de même pour `offres` (`OffreRow[]` → `OffreAffichee[]`), import inclus. Le composant `CarteOffres` continue de recevoir des `OffreRow[]` sans changement (`OffreAffichee` en est un sur-type).

- [ ] **Step 3: Afficher le badge dans la carte**

Dans `src/components/offre-card.tsx`, élargir le type de `offre` pour inclure `plateformes` et ajouter la ligne sous `.emp` :

Remplacer `offre: OffreRow` par `offre: OffreRow & { plateformes?: string[] }` dans les props.

Après la `<div className="emp">...</div>`, ajouter :

```tsx
      {offre.plateformes && offre.plateformes.length > 1 && (
        <div className="offre-plateformes">Aussi sur {offre.plateformes.slice(1).join(', ')}</div>
      )}
```

- [ ] **Step 4: Style du badge**

Dans `src/app/globals.css`, ajouter :

```css
.offre-plateformes { margin-top: 4px; font-size: .74rem; color: var(--muted); }
```

- [ ] **Step 5: Vérifier tests + build**

Run: `npx vitest run && npx next build`
Expected: tous les tests passent, build réussi.

- [ ] **Step 6: Commit**

```bash
git add src/app/recherche/ src/components/resultats-shell.tsx src/components/offre-liste.tsx src/components/offre-card.tsx src/app/globals.css
git commit -m "feat(resultats): affiche une carte par offre + badge Aussi sur les autres plateformes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Note

La carte (`carte-offres`) affiche les mêmes offres dédoublonnées (une représentante par groupe), donc un seul pin par offre. Le badge n'apparaît que dans la liste, ce qui suffit ; on pourra l'ajouter au popup de la carte plus tard si besoin.
