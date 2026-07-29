# JobCompass MVP Brique 3.1 : Finitions de l'interface · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Corriger le filtre lieu/rayon (qui n'affine pas réellement) et ajouter les finitions demandées : autocomplétion métier + ville, zoom carte au clic d'une offre, refonte des pages profil / offres likées / paramètres avec bouton retour.

**Architecture:** Suite de la Brique 3 (branche `feat/mvp-3-interface`). On ajoute des colonnes de coordonnées à `recherches`, un filtre par rayon à la lecture, des composants d'autocomplétion clients, le câblage `expandedId → focus carte`, et de vraies pages profil/paramètres à la DA.

**Tech Stack:** Next.js 16, React 19, Supabase, Leaflet, Tailwind v4, Vitest. Autocomplétion ville via `api-adresse.data.gouv.fr` (sans clé).

## Global Constraints

- Jamais de tiret cadratin « — » (: , ou ·). Textes en français.
- Chaque fichier de test importe explicitement les helpers Vitest/RTL (`import { expect, test } from 'vitest'`, etc.) sinon `tsc`/`next build` casse (`**/*.ts` type-checké).
- Écritures utilisateur via client session (RLS) ; collecte via client service. `redirect` hors try/catch dans les Server Actions.
- Vérif finale par tâche : `npx tsc --noEmit` propre, `npm run build` OK, `npm test` vert.
- Référence visuelle DA : `docs/superpowers/specs/mockups/interface-mockup.html` (classes déjà portées dans globals.css : `.detail-*`, `.side-*`, `.card`, `.liked-*`, `.account`, `.field`, `.btn-*`, `.ava`).
- Commits fréquents.

---

## Task 1: Filtre lieu/rayon effectif (le vrai bug)

**Problème:** `affinerLieu` relance une collecte pour la commune, mais les offres s'accumulent dans `resultats` et la lecture renvoie TOUTES les offres liées, sans filtrer par lieu. Le lieu/rayon n'affine donc jamais l'affichage. Correctif : stocker les coordonnées de la commune sur la recherche et filtrer les offres affichées par distance (haversine) dans le rayon.

**Files:**
- Create: `supabase/migrations/0003_recherche_coords.sql`
- Create: `src/lib/geo/distance.ts`
- Test: `src/lib/geo/distance.test.ts`
- Modify: `src/lib/recherche/actions.ts` (affinerLieu stocke lat/lng)
- Modify: `src/lib/recherche/offres.ts` (getRecherche sélectionne lat/lng)
- Modify: `src/app/recherche/[id]/page.tsx` (filtre par rayon avant de passer à ResultatsShell)

**Interfaces:**
- Produces: `distanceKm(a: {lat:number,lng:number}, b: {lat:number,lng:number}): number` (haversine) ; `filtrerDansRayon(offres: OffreRow[], centre: {lat:number,lng:number}, rayonKm: number): OffreRow[]` (garde les offres dont la position, via `positionEpingle`, est à <= rayonKm ; exclut celles sans position). `getRecherche` renvoie aussi `latitude`/`longitude`.

- [ ] **Step 1: Migration**

Create `supabase/migrations/0003_recherche_coords.sql` :
```sql
alter table public.recherches add column if not exists latitude double precision;
alter table public.recherches add column if not exists longitude double precision;
```

- [ ] **Step 2: Test du filtre distance**

Create `src/lib/geo/distance.test.ts` :
```ts
import { expect, test } from 'vitest'
import { distanceKm, filtrerDansRayon } from './distance'
import type { OffreRow } from '@/lib/offres/types'

test('distanceKm : Nantes -> Rennes ~ 100 km', () => {
  const d = distanceKm({ lat: 47.2184, lng: -1.5536 }, { lat: 48.1173, lng: -1.6778 })
  expect(d).toBeGreaterThan(95); expect(d).toBeLessThan(115)
})

const o = (id: string, lat: number | null, lng: number | null, ville: string | null): OffreRow => ({
  id, source: 'ft', source_id: id, titre: 't', entreprise: null, entreprise_logo: null, description: null,
  contrat: null, salaire: null, latitude: lat, longitude: lng, ville, url_postuler: null, email_contact: null,
  date_publication: null,
})

test('filtrerDansRayon : garde Nantes dans 50km, exclut Rennes', () => {
  const centre = { lat: 47.2184, lng: -1.5536 }
  const out = filtrerDansRayon([o('nantes', 47.21, -1.55, null), o('rennes', 48.11, -1.67, null)], centre, 50)
  expect(out.map((x) => x.id)).toEqual(['nantes'])
})

test('filtrerDansRayon : offre sans position exclue', () => {
  const out = filtrerDansRayon([o('x', null, null, 'Lieu inconnu')], { lat: 47, lng: -1 }, 50)
  expect(out).toEqual([])
})
```

- [ ] **Step 3: Run test (échec attendu)** — `npm test -- geo/distance` → FAIL.

- [ ] **Step 4: Implémenter**

Create `src/lib/geo/distance.ts` :
```ts
import { positionEpingle } from './departements'
import type { OffreRow } from '@/lib/offres/types'

const R = 6371 // rayon terrestre km
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function filtrerDansRayon(offres: OffreRow[], centre: { lat: number; lng: number }, rayonKm: number): OffreRow[] {
  return offres.filter((o) => {
    const p = positionEpingle(o)
    return p ? distanceKm(centre, p) <= rayonKm : false
  })
}
```

- [ ] **Step 5: Run test** — `npm test -- geo/distance` → PASS.

- [ ] **Step 6: affinerLieu stocke les coordonnées**

In `src/lib/recherche/actions.ts`, dans `affinerLieu`, l'update doit aussi écrire `latitude`/`longitude` :
```ts
    .update({ localisation: geo ? geo.insee : null, rayon_km: rayonKm, latitude: geo ? geo.lat : null, longitude: geo ? geo.lng : null })
```

- [ ] **Step 7: getRecherche renvoie lat/lng**

In `src/lib/recherche/offres.ts`, `getRecherche` : ajoute `latitude, longitude` au `.select(...)` et au type de retour (`latitude: number | null; longitude: number | null`).

- [ ] **Step 8: Filtrer à la lecture dans la page résultats**

In `src/app/recherche/[id]/page.tsx`, après `getOffresForRecherche`, applique le filtre si la recherche a des coordonnées ET un rayon :
```ts
  let offres = await getOffresForRecherche(supabase, id)
  if (recherche.latitude != null && recherche.longitude != null && recherche.rayon_km != null) {
    offres = filtrerDansRayon(offres, { lat: recherche.latitude, lng: recherche.longitude }, recherche.rayon_km)
  }
```
Importe `filtrerDansRayon`. Passe `offres` filtrées à `ResultatsShell` (les props `recherche` incluent déjà id/intitule/localisation/rayon_km ; ajoute latitude/longitude si utile, sinon garde tel quel).

- [ ] **Step 9: Vérif + commit** — `tsc` propre, `npm run build` OK, `npm test` vert.
```bash
git add -A && git commit -m "fix(filtres): lieu+rayon restreignent réellement (coords recherche + filtre haversine)"
```

Note humaine : la migration `0003_recherche_coords.sql` est à appliquer sur Supabase distant.

---

## Task 2: Autocomplétion métier (accueil) + ville (filtres)

**Files:**
- Create: `src/lib/geo/autocomplete.ts` (recherche de communes)
- Create: `src/components/ville-autocomplete.tsx`
- Create: `src/components/metier-autocomplete.tsx`
- Modify: `src/components/search-bar.tsx` (utilise metier-autocomplete)
- Modify: `src/components/filtres-bar.tsx` (utilise ville-autocomplete)
- Test: `src/lib/geo/autocomplete.test.ts`, `src/components/metier-autocomplete.test.tsx`

**Interfaces:**
- Produces: `chercherCommunes(q: string, fetchImpl?): Promise<{ label: string; insee: string; lat: number; lng: number }[]>` (API adresse, type=municipality, limit 6, [] si <2 caractères). `METIERS_DIETETIQUE: string[]`. `VilleAutocomplete` props `{ value: string; onChange: (v: string) => void; onSelect?: (c: {label,insee,lat,lng}) => void; onValider: () => void }`. `MetierAutocomplete` props `{ value: string; onChange: (v: string) => void; onSubmit: () => void }`.

- [ ] **Step 1: Liste métiers + recherche communes + test**

Create `src/lib/geo/autocomplete.ts` :
```ts
export const METIERS_DIETETIQUE = [
  'Diététicien', 'Diététicienne', 'Diététicien nutritionniste', 'Nutritionniste',
  'Conseiller en nutrition', 'Diététicien hospitalier', 'Diététicien en restauration collective',
  'Nutrithérapeute', 'Diététicien libéral',
]

const BASE = 'https://api-adresse.data.gouv.fr/search/'
export async function chercherCommunes(
  q: string, fetchImpl: typeof fetch = fetch,
): Promise<{ label: string; insee: string; lat: number; lng: number }[]> {
  if (q.trim().length < 2) return []
  const res = await fetchImpl(`${BASE}?q=${encodeURIComponent(q)}&type=municipality&limit=6`)
  if (!res.ok) return []
  const json = (await res.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: { citycode: string; label: string } }[] }
  return (json.features ?? []).map((f) => ({ label: f.properties.label, insee: f.properties.citycode, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }))
}
```

Create `src/lib/geo/autocomplete.test.ts` :
```ts
import { expect, test } from 'vitest'
import { chercherCommunes } from './autocomplete'

const fake = (json: unknown): typeof fetch => (async () => ({ ok: true, json: async () => json })) as unknown as typeof fetch

test('chercherCommunes mappe les features', async () => {
  const r = await chercherCommunes('Nant', fake({ features: [{ geometry: { coordinates: [-1.55, 47.21] }, properties: { citycode: '44109', label: 'Nantes' } }] }))
  expect(r).toEqual([{ label: 'Nantes', insee: '44109', lat: 47.21, lng: -1.55 }])
})

test('chercherCommunes : requête trop courte -> []', async () => {
  expect(await chercherCommunes('N', fake({ features: [] }))).toEqual([])
})
```

- [ ] **Step 2: Run test** — `npm test -- geo/autocomplete` → PASS (après implémentation).

- [ ] **Step 3: Composant MetierAutocomplete + test**

Create `src/components/metier-autocomplete.tsx` (client) : un input contrôlé + une liste déroulante des `METIERS_DIETETIQUE` filtrés par `value` (insensible à la casse), affichée au focus/saisie ; clic sur une suggestion appelle `onChange(suggestion)` et ferme la liste ; `onSubmit` déclenché à Entrée. Utilise la classe `.searchbar` existante pour l'input (dans search-bar) ou un style neutre ; ferme la liste au clic extérieur (listener document nettoyé au démontage). Chaque suggestion est un `<button type="button">`.

Create `src/components/metier-autocomplete.test.tsx` : rend le composant avec `value=''`, tape « diét », vérifie qu'au moins une suggestion « Diététicien » apparaît, clique dessus, vérifie que `onChange` est appelé avec « Diététicien ». (Imports RTL/Vitest explicites.)

- [ ] **Step 4: Composant VilleAutocomplete**

Create `src/components/ville-autocomplete.tsx` (client) : input contrôlé (classe `.field` compatible topbar) ; à chaque frappe (debounce ~250 ms via setTimeout nettoyé), appelle `chercherCommunes(value)` et affiche jusqu'à 6 suggestions en liste déroulante ; clic sur une suggestion → `onChange(label)` + `onSelect(commune)` + `onValider()` ; ferme au clic extérieur (listener nettoyé). Gère l'annulation des requêtes obsolètes (garde un compteur/flag). Pas de test unitaire réseau requis (couvert par `chercherCommunes`).

- [ ] **Step 5: Brancher dans SearchBar et FiltresBar**

- `src/components/search-bar.tsx` : remplace le `<input>` de la barre par `<MetierAutocomplete value={poste} onChange={setPoste} onSubmit={() => poste.trim() && startTransition(() => lancerRecherche(poste))} />` (garde le titre animé et le bouton Rechercher). Le placeholder animé peut rester géré dans MetierAutocomplete via une prop `placeholder`, ou être retiré si conflit (garder simple : une prop placeholder statique « Diététicien, nutritionniste... » suffit ; le titre animé reste l'effet vivant principal).
- `src/components/filtres-bar.tsx` : remplace le `<input>` Lieu par `<VilleAutocomplete value={ville} onChange={setVille} onValider={() => relancer()} />`. Le champ garde le comportement de relance.

- [ ] **Step 6: Vérif + commit** — `tsc`, build, tests verts.
```bash
git add -A && git commit -m "feat(autocomplete): suggestions métier (accueil) et ville (filtres, API adresse)"
```

---

## Task 3: Clic sur une offre à gauche -> zoom carte + épingle en évidence

**Files:**
- Modify: `src/components/carte-offres.tsx` (réagir à `expandedId` : focus + popup)

**Interfaces:**
- Consumes: la prop `expandedId` déjà reçue par `CarteOffres` (actuellement inutilisée).

- [ ] **Step 1: Focus carte sur expandedId**

In `src/components/carte-offres.tsx`, ajoute un `useEffect` dépendant de `[props.expandedId]` : si `expandedId` non nul et que le marqueur existe (`markersRef.current[expandedId]`), fais un `mapRef.current.setView([lat, lng], 12, { animate: true })` (récupère lat/lng depuis `pointsFor` ou depuis le marqueur `getLatLng()`), puis `clusterRef.current?.zoomToShowLayer?.(m, () => m.openPopup())` (sinon `m.openPopup()`), et applique la classe `.active` à son épingle (le survol se gère déjà ailleurs mais force ici l'évidence). Garde le tout dans un try/catch silencieux (jsdom). Ne casse pas la reconstruction des marqueurs : cet effet ne doit PAS être dans le même useEffect que la construction.

- [ ] **Step 2: Vérif + commit** — `tsc`, build, `npm test` (dont carte-offres) verts.
```bash
git add -A && git commit -m "feat(carte): clic sur une offre zoome et met en évidence son épingle"
```

Note : `ResultatsShell` passe déjà `expandedId` à `CarteOffres` ; le clic sur une carte (accordéon) met à jour `expandedId`, ce qui déclenche le focus. Aucune modif de ResultatsShell nécessaire ; vérifie-le et, si `expandedId` n'est pas passé, ajoute-le.

---

## Task 4: Refonte de la page profil (DA + bouton retour)

**Files:**
- Modify: `src/app/profil/page.tsx`
- Modify: `src/app/profil/profil-form.tsx` (habillage DA des champs)
- Create: `src/components/page-header.tsx` (en-tête réutilisable avec bouton retour)

**Interfaces:**
- Produces: `PageHeader` (client) props `{ titre: string }` : barre supérieure `.detail-top` avec un bouton « Retour » (`history.back()`) et le logo. Réutilisable par profil et paramètres.

- [ ] **Step 1: PageHeader**

Create `src/components/page-header.tsx` (client, `'use client'` car `history.back()`) : rend `<div className="detail-top"><button className="back" onClick={() => history.back()}>‹ Retour</button><div className="logo">Job<span>Compass</span></div></div>`. Utilise l'icône chevron SVG comme dans la maquette (`.back`).

- [ ] **Step 2: Refonte page profil**

In `src/app/profil/page.tsx` : enveloppe la page dans `<PageHeader titre="Mon profil" />` + un conteneur `.detail-hero`/`.detail-wrap` (comme la page offre) : en-tête avec avatar (initiale du nom ou email), titre « Mon profil », email ; puis le `ProfilForm` dans une carte (`.side-card` ou une carte blanche arrondie) ; puis la section « Mes offres likées » (déjà via `OffresLikees`, garder). Style à la DA (Montserrat, arrondis, ombres douces, accent vert). Reste un composant serveur async ; `PageHeader` (client) est monté dedans.

- [ ] **Step 3: Habillage du formulaire**

In `src/app/profil/profil-form.tsx` : remplace les classes utilitaires brutes par un style cohérent DA (champs `rounded-xl border`, labels en `text-sm`, bouton « Enregistrer » en `.btn-primary` ou style vert cohérent). Garde toute la logique (upsertProfil, uploadCv) intacte.

- [ ] **Step 4: Vérif + commit** — `tsc`, build, tests verts (dont profil existants).
```bash
git add -A && git commit -m "feat(profil): refonte à la DA avec en-tête et bouton retour"
```

---

## Task 5: Page Paramètres + câblage de l'espace compte

**Files:**
- Create: `src/app/parametres/page.tsx`
- Create: `src/components/parametres-form.tsx`
- Modify: `src/components/compte-menu.tsx` (lien Paramètres + avatar initiale utilisateur + item likées)
- Modify: `src/app/layout.tsx` (passer l'email/nom au CompteMenu) OU CompteMenu lit la session côté client
- Modify: `src/proxy.ts` (protéger `/parametres`)
- Test: `src/components/parametres-form.test.tsx`

**Interfaces:**
- Produces: page serveur `/parametres` (redirect /login si non authentifié) rendant `PageHeader` + `ParametresForm`. `ParametresForm` (client) props `{ email: string }` : affiche l'email (lecture), un formulaire « changer le mot de passe » (nouveau mot de passe + confirmation → `getBrowserClient().auth.updateUser({ password })`), et un bouton « Se déconnecter » (`signOut()` + redirection /login).

- [ ] **Step 1: ParametresForm + test**

Create `src/components/parametres-form.tsx` (client) : affiche `email` en lecture ; champ mot de passe + confirmation, bouton « Mettre à jour le mot de passe » qui vérifie que les deux correspondent (message d'erreur sinon) et appelle `getBrowserClient().auth.updateUser({ password })` (message de succès/erreur) ; bouton « Se déconnecter ». Style DA (`.side-card`, `.btn-primary`).

Create `src/components/parametres-form.test.tsx` : mocke `@/lib/supabase/client` (getBrowserClient → objet avec `auth.updateUser` mock) ; rend avec `email='a@b.c'`, vérifie l'affichage de l'email, saisit deux mots de passe différents, clique « Mettre à jour », vérifie le message d'erreur « ne correspondent pas ». (Imports RTL/Vitest explicites.)

- [ ] **Step 2: Page /parametres**

Create `src/app/parametres/page.tsx` (serveur async) : `getServerClient` + redirect /login si pas d'user ; rend `<PageHeader titre="Paramètres" />` + `<ParametresForm email={user.email ?? ''} />` dans un conteneur `.detail-wrap`.

- [ ] **Step 3: Protéger la route**

In `src/proxy.ts` : ajoute `/parametres` à `isProtected` et `/parametres/:path*` au `config.matcher`.

- [ ] **Step 4: Câbler l'espace compte**

In `src/components/compte-menu.tsx` : « Paramètres du compte » devient un lien vers `/parametres`. L'avatar `.ava` doit afficher l'initiale réelle de l'utilisateur (1re lettre de l'email) plutôt que « M » en dur : comme CompteMenu est global (monté dans layout), récupère l'email côté client via `getBrowserClient().auth.getUser()` dans un `useEffect` et affiche l'initiale (repli « ? » si absent). Ajoute aussi l'en-tête `.acc-head` (email) dans le menu.

- [ ] **Step 5: Vérif + commit** — `tsc`, build, `npm test` (dont parametres-form) verts.
```bash
git add -A && git commit -m "feat(compte): page paramètres (mot de passe, déconnexion) + espace compte câblé"
```

---

## Validation E2E finale (après Task 5)

Migrations `0002` (déjà appliquée) et `0003_recherche_coords.sql` (à appliquer) sur Supabase distant, puis :
1. Accueil : autocomplétion métier ; lancer une recherche.
2. Résultats : choisir une ville (autocomplétion) + un rayon → la liste ET la carte se restreignent réellement au secteur.
3. Cliquer une offre à gauche → la carte zoome et met l'épingle en évidence.
4. Menu compte : avatar avec initiale ; « Mon profil » (refonte propre + retour) ; « Paramètres » (changer mot de passe, déconnexion, retour).
