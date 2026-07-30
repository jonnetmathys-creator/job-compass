# Responsive / mobile friendly · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre toute l'app JobCompass utilisable sur mobile (téléphones + tablettes portrait) sans aucune régression desktop, sans débordement horizontal.

**Architecture:** Media queries `max-width: 768px` (et `480px` pour les fins) regroupées dans une section « Responsive » à la fin de `globals.css` ; un état `vue` (Liste/Carte) ajouté à `resultats-shell` pour la bascule mobile de la page résultats ; petites JSX (labels enveloppés dans des `span` pour pouvoir masquer le texte des boutons sur mobile). Aucune dépendance ajoutée.

**Tech Stack:** Next.js 16 App Router, React 19, CSS pur (globals.css), Vitest + @testing-library/react + userEvent, Leaflet.

## Global Constraints

- Français partout, jamais le caractère tiret cadratin `—` (utiliser `:`, `,` ou `·`).
- Aucune régression du rendu **desktop** (les nouvelles règles vivent dans des media queries `max-width`).
- Aucun **débordement horizontal** sur aucune page à aucune largeur.
- Cibles interactives ≥ 44px de haut sur mobile.
- Respect de `prefers-reduced-motion` (déjà en place, ne pas casser).
- Tous les tests existants restent verts ; `next build` OK.
- Commandes lancées depuis `/Users/mathys.jnt/job-compass` (préfixer `cd` si le shell repart du home).

---

### Task 1: Viewport + bascule Liste/Carte (page résultats)

**Files:**
- Modify: `src/app/layout.tsx` (ajout `export const viewport`)
- Modify: `src/components/resultats-shell.tsx`
- Modify: `src/app/globals.css` (règles structurelles de la bascule)
- Test: `src/components/resultats-shell.test.tsx` (ajout d'un test)

**Interfaces:**
- Produces : dans `resultats-shell`, un état `vue: 'liste' | 'carte'` (défaut `'liste'`), le conteneur `.split` reçoit la classe `vue-liste` ou `vue-carte`, et une barre `.segment-vue` (deux boutons `role="tab"` avec `aria-selected`).

- [ ] **Step 1: Ajouter le viewport dans le layout**

Dans `src/app/layout.tsx`, sous l'import de `Metadata`, ajouter l'export (Next 16 : le viewport se déclare séparément de `metadata`) :
```tsx
import type { Metadata, Viewport } from 'next'
```
et après `export const metadata` :
```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}
```

- [ ] **Step 2: Écrire le test de la bascule (échoue d'abord)**

Ajouter à la fin de `src/components/resultats-shell.test.tsx` :
```tsx
test('la bascule Liste/Carte change la vue active', async () => {
  render(<ResultatsShell recherche={{ id: 'r1', intitule: 'Diét', localisation: null, rayon_km: null, lieu_label: null }}
    offres={[o('1', 'CDI')]} favoriIds={[]} />)
  const liste = screen.getByRole('tab', { name: 'Liste' })
  const carte = screen.getByRole('tab', { name: 'Carte' })
  expect(liste).toHaveAttribute('aria-selected', 'true')
  expect(carte).toHaveAttribute('aria-selected', 'false')
  await userEvent.click(carte)
  expect(carte).toHaveAttribute('aria-selected', 'true')
  expect(liste).toHaveAttribute('aria-selected', 'false')
  expect(document.getElementById('split')).toHaveClass('vue-carte')
})
```

- [ ] **Step 3: Lancer le test pour le voir échouer**

Run: `npx vitest run src/components/resultats-shell.test.tsx`
Expected: FAIL (pas de `role="tab"` Liste/Carte).

- [ ] **Step 4: Implémenter la bascule dans `resultats-shell.tsx`**

Ajouter l'import `useEffect` (déjà `useMemo, useState` importés) : la ligne d'import devient
```tsx
import { useEffect, useMemo, useState } from 'react'
```
Ajouter l'état sous les autres `useState` :
```tsx
  const [vue, setVue] = useState<'liste' | 'carte'>('liste')
```
Ajouter, après les `useMemo`, un effet qui « réveille » Leaflet quand la carte (re)devient visible sur mobile (une carte rendue dans un conteneur masqué a une taille nulle) :
```tsx
  // Quand on bascule sur la carte (mobile), Leaflet doit recalculer sa taille.
  useEffect(() => {
    if (vue !== 'carte') return
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
    return () => clearTimeout(t)
  }, [vue])
```
Dans le JSX, juste avant `<div className={\`split...`}>`, insérer la barre segmentée (masquée sur desktop par CSS) :
```tsx
      <div className="segment-vue" role="tablist" aria-label="Affichage des résultats">
        <button type="button" role="tab" aria-selected={vue === 'liste'} className={vue === 'liste' ? 'on' : ''} onClick={() => setVue('liste')}>Liste</button>
        <button type="button" role="tab" aria-selected={vue === 'carte'} className={vue === 'carte' ? 'on' : ''} onClick={() => setVue('carte')}>Carte</button>
      </div>
```
Et ajouter la classe `vue-<vue>` au conteneur `.split` (garder `collapsed` existant) :
```tsx
      <div className={`split vue-${vue}${collapsed ? ' collapsed' : ''}`} id="split">
```

- [ ] **Step 5: Ajouter les règles CSS structurelles**

À la fin de `src/app/globals.css`, ajouter :
```css

/* ── Responsive : bascule Liste/Carte (page résultats) ──────────────── */
.segment-vue { display: none; } /* visible seulement sur mobile (voir media query 768px) */
.segment-vue button {
  flex: 1; padding: 10px; border: 0; background: transparent; font-family: inherit;
  font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; border-radius: 9px;
}
.segment-vue button.on { background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); }
```

- [ ] **Step 6: Lancer le test + le build**

Run: `npx vitest run src/components/resultats-shell.test.tsx && npx next build`
Expected: tests PASS, build OK.

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/components/resultats-shell.tsx src/components/resultats-shell.test.tsx src/app/globals.css
git commit -m "feat(responsive): viewport + bascule Liste/Carte sur la page résultats"
```

---

### Task 2: CSS responsive de la page résultats (en-tête + filtres + split)

**Files:**
- Modify: `src/components/filtres-bar.tsx` (envelopper le label « Filtres »)
- Modify: `src/components/alerte-mail-toggle.tsx` (envelopper le label « Alertes mail »)
- Modify: `src/app/globals.css` (media queries résultats)

**Interfaces:**
- Consumes : `.segment-vue`, `.split.vue-liste`, `.split.vue-carte` (Task 1).
- Produces : classe `.btn-label` sur les libellés texte des boutons Filtres et Alertes (masquée sur mobile).

- [ ] **Step 1: Envelopper le label du bouton Filtres**

Dans `src/components/filtres-bar.tsx`, le bouton contient le texte `Filtres` entre le svg d'icône et la pastille. Remplacer le texte nu `Filtres` par :
```tsx
          <span className="btn-label">Filtres</span>
```
(ne pas toucher au svg, à `{actifs > 0 && ...}` ni au chevron).

- [ ] **Step 2: Envelopper le label du toggle Alertes**

Dans `src/components/alerte-mail-toggle.tsx`, remplacer le texte nu `Alertes mail` (après le `</span>` de `.alerte-cloche`) par :
```tsx
      <span className="btn-label">Alertes mail</span>
```

- [ ] **Step 3: Ajouter les media queries de la page résultats**

À la fin de `src/app/globals.css`, ajouter :
```css

/* ── Responsive : page résultats sous 768px ─────────────────────────── */
@media (max-width: 768px) {
  /* En-tête compact : on réserve la place de la cloche + avatar (fixés en haut à droite) */
  .topbar { gap: 8px; padding: 12px 14px; padding-right: 104px; }
  .topbar .logo { font-size: 17px; margin-right: 2px; }
  .poste-chip { font-size: 13px; padding: 7px 11px; max-width: 34vw; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .filtres-btn .btn-label, .alerte-toggle .btn-label, .filtres-chevron { display: none; }
  .filtres-btn, .alerte-toggle { padding: 9px 11px; }

  /* Panneau filtres en (quasi) pleine largeur */
  .filtres-panel { width: auto; left: 14px; right: 14px; }

  /* Bascule visible, bouton de repli desktop masqué */
  .segment-vue { display: flex; gap: 4px; margin: 10px 14px 0; padding: 4px; background: #eef0ee; border-radius: 12px; }
  .map-toggle { display: none; }

  /* Liste et carte en pleine largeur, on n'en montre qu'une selon la vue */
  .list-pane { width: 100%; }
  .split.vue-liste .map-pane { display: none; }
  .split.vue-carte .list-pane { display: none; }
  .split.collapsed .list-pane { transform: none; margin-left: 0; } /* neutralise le repli desktop */
}
```

- [ ] **Step 4: Lancer la suite + le build**

Run: `npx vitest run && npx next build`
Expected: 151 tests PASS (les 150 + le test bascule de Task 1), build OK. Les attributs/labels n'affectent pas les tests existants.

- [ ] **Step 5: Commit**

```bash
git add src/components/filtres-bar.tsx src/components/alerte-mail-toggle.tsx src/app/globals.css
git commit -m "feat(responsive): en-tête compact + filtres pleine largeur + split mobile (résultats)"
```

---

### Task 3: CSS responsive des autres pages

**Files:**
- Modify: `src/app/globals.css` (media queries offre, candidature, suivi, favoris/profil, accueil, modales)

**Interfaces:**
- Consumes : rien. Produces : rien (CSS pur).

- [ ] **Step 1: Ajouter les media queries des autres pages**

À la fin de `src/app/globals.css`, ajouter :
```css

/* ── Responsive : autres pages sous 768px ───────────────────────────── */
@media (max-width: 768px) {
  /* Marges de contenu générales */
  .detail-wrap { padding-left: 16px; padding-right: 16px; }
  .detail-top { padding: 12px 14px; }

  /* Offre : une colonne (déjà proche), carte latérale et boutons pleine largeur */
  .detail-grid { grid-template-columns: 1fr; gap: 18px; }
  .detail-side { position: static; }
  .detail-hero { padding-left: 16px; padding-right: 16px; }
  .side-map { height: 200px; }

  /* Candidature IA : l'éditeur est déjà en colonne ; on fait passer la barre d'outils
     à la ligne, on met la saisie à 16px (évite le zoom iOS) et les actions pleine largeur */
  .cand-toolbar, .cand-toolbar-btns { flex-wrap: wrap; }
  .cand-card-body input, .cand-card-body textarea { font-size: 16px; }
  .cand-postuler .btn-primary, .cand-postuler .btn-lg { width: 100%; }

  /* Suivi : cartes pleine largeur */
  .suivi-carte { width: 100%; }

  /* Accueil : barre de recherche confortable */
  .searchbar { max-width: 100%; padding: 6px 6px 6px 16px; }
  .searchbar input { font-size: 16px; } /* >=16px : évite le zoom auto iOS */
  .hero .logo { font-size: 23px; margin-bottom: 24px; }
}

/* ── Responsive : très petits écrans sous 480px ─────────────────────── */
@media (max-width: 480px) {
  .suivi-stats { grid-template-columns: 1fr; }
  .pm-actions { flex-direction: column; }
  .searchbar .btn-primary { padding: 12px 18px; }
}
```

Classes confirmées dans le code : `.detail-grid`/`.detail-side`/`.detail-hero`/`.detail-wrap`/`.detail-top`/`.side-map` (offre), `.cand-toolbar`/`.cand-toolbar-btns`/`.cand-card-body`/`.cand-postuler` (candidature), `.suivi-carte`/`.suivi-stats` (suivi, `.suivi-stats` a déjà un palier 620px, on ajoute 480px), `.searchbar`/`.hero .logo` (accueil), `.pm-actions` (modales). Aucune classe inventée.

- [ ] **Step 2: Build**

Run: `npx next build`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(responsive): empilement mobile des pages offre, candidature, suivi, accueil, modales"
```

---

### Task 4: Passe finale (anti-débordement + cibles tactiles)

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes/Produces : rien (CSS pur).

- [ ] **Step 1: Ajouter le filet anti-débordement et les cibles tactiles**

À la fin de `src/app/globals.css`, ajouter :
```css

/* ── Responsive : filet anti-débordement + confort tactile ──────────── */
@media (max-width: 768px) {
  html, body { overflow-x: hidden; }
  img, svg, video { max-width: 100%; }
  /* Cibles tactiles : hauteur mini confortable sur les actions clés */
  .btn-primary, .btn-apply, .btn-ia, .btn-save, .filtres-btn, .alerte-toggle,
  .segment-vue button, .pm-btn, .tour-suiv { min-height: 44px; }
}
```

- [ ] **Step 2: Vérifier visuellement l'absence de débordement (manuel)**

Lancer le serveur (`npm run dev`), ouvrir les DevTools en mode responsive et vérifier à **375px, 414px et 768px**, sur chaque page (accueil, résultats + bascule Liste/Carte, offre, candidature IA, suivi, favoris, profil, paramètres, login, signup) :
- aucune barre de scroll horizontale,
- l'en-tête résultats ne chevauche pas la cloche/avatar,
- le panneau Filtres tient dans l'écran,
- les boutons se tapent au doigt.
Noter tout souci résiduel et le corriger dans `globals.css` (ajustements ciblés).

- [ ] **Step 3: Suite complète + build**

Run: `npx vitest run && npx next build`
Expected: tous les tests PASS, build OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(responsive): filet anti-débordement horizontal + cibles tactiles"
```

---

## Notes d'exécution

- Le responsive est essentiellement du CSS : la vérification clé est **manuelle** aux largeurs 375/414/768px (aucun débordement, chaque page utilisable). Seule la bascule Liste/Carte porte un test unitaire.
- Ne pas modifier le rendu desktop : toutes les nouvelles règles sont sous `@media (max-width: ...)`, sauf la déclaration de base `.segment-vue { display: none }` (Task 1) qui cache la bascule sur desktop.
- Si un nom de classe du plan ne correspond pas au markup réel (`.cand-grid`, `.suivi-carte`), l'aligner sur le markup avant de committer.
