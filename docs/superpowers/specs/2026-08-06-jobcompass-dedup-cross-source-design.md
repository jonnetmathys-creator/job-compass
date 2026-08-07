# Déduplication cross-source à l'affichage · Design

**Goal :** quand une même offre remonte de plusieurs sources (France Travail, Adzuna, AFDN, StaffSanté), n'afficher qu'une seule carte dans les résultats, en indiquant les autres plateformes où elle est présente ("Aussi sur ...").

**Architecture :** groupement au moment de bâtir les résultats (pas en base). Une fonction pure normalise une empreinte `titre + ville + entreprise` et regroupe les offres ; on garde la plus complète comme représentante et on lui attache la liste des plateformes du groupe. Aucune migration, une seule normalisation, entièrement réversible.

**Tech Stack :** TypeScript, Next.js 16, Vitest.

## Global Constraints

- Jamais de tiret cadratin. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- Logique de dédup en **fonction pure testable** ; la page résultats ne fait que l'appeler.
- Messages de commit terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commits locaux uniquement.

## Décisions validées

- Clé de dédup : **titre + ville + entreprise** (normalisés). Choix strict : moins de faux positifs. Conséquence assumée : une offre sans entreprise (AFDN) ne fusionne pas avec une offre France Travail du même poste.
- Présentation : on affiche **une carte** avec un badge **"Aussi sur ..."** listant les autres plateformes du groupe.
- Représentante conservée : la plus complète (coords, puis description, puis la plus récente).

## Composant : `src/lib/offres/dedup-affichage.ts`

### Libellés des sources

```ts
const LIBELLES_SOURCE: Record<string, string> = {
  france_travail: 'France Travail',
  adzuna: 'Adzuna',
  afdn: 'AFDN',
  staffsante: 'StaffSanté',
  jooble: 'Jooble',
  manuelle: 'Ajout manuel',
}
```
Une source inconnue est affichée telle quelle (fallback sur la valeur brute).

### Empreinte

`empreinte(offre): string` = `norm(titre) + '|' + norm(ville) + '|' + norm(entreprise)`.

`norm(s)` :
- `null`/`undefined` → `''`
- minuscules
- suppression des accents (`normalize('NFD')` puis retrait des diacritiques)
- retrait des mentions `h/f`, `(h/f)`, `h-f`, `(h-f)`, `f/h` (variantes de genre)
- retrait de la ponctuation (tout sauf lettres/chiffres/espaces)
- espaces compactés + `trim`

### Type et fonction

```ts
export type OffreAffichee = OffreRow & { plateformes: string[] }

export function dedupeAffichage(offres: OffreRow[]): OffreAffichee[]
```

Algorithme (préserve l'ordre d'entrée) :
1. Parcourir `offres` dans l'ordre. Pour chacune, calculer l'empreinte.
2. Empreinte inédite → créer un groupe, cette offre est représentante provisoire.
3. Empreinte déjà vue → ajouter au groupe ; si la nouvelle offre est **plus complète** que la représentante, elle la remplace (le rang du groupe dans la sortie ne change pas).
4. `plateformes` d'un groupe = libellés distincts des sources de tous ses membres, la source de la représentante en premier.
5. Sortie : les représentantes dans l'ordre d'apparition, chacune avec son tableau `plateformes`.

"Plus complète" (comparaison entre deux offres) : a des coordonnées l'emporte ; à égalité, a une description l'emporte ; à égalité, `date_publication` la plus récente (nulls en dernier) l'emporte ; sinon on garde la représentante en place.

## Intégration : `src/app/recherche/[id]/page.tsx`

Après le filtre rayon existant, appliquer `dedupeAffichage` avant de passer les offres au shell :

```ts
const offres = dedupeAffichage(
  recherche.latitude != null && recherche.longitude != null && recherche.rayon_km != null
    ? filtrerDansRayon(offresBrutes, { lat: recherche.latitude, lng: recherche.longitude }, recherche.rayon_km)
    : offresBrutes,
)
```

`ResultatsShell` reçoit désormais des `OffreAffichee[]` (compatibles `OffreRow`, avec le champ `plateformes` en plus). La liste ET la carte affichent donc les résultats dédoublonnés.

## Présentation : badge "Aussi sur ..."

Dans la carte d'offre (`OffreCard`), sous l'entreprise/lieu, si `plateformes.length > 1` afficher une ligne discrète : `Aussi sur <plateformes sauf la première, jointes par ", ">`. Exemple : représentante France Travail présente aussi sur StaffSanté → `Aussi sur StaffSanté`.

Le composant reçoit `plateformes` via les props d'offre (le shell propage le champ). Une classe CSS légère (`.offre-plateformes`) style la ligne.

## Gestion d'erreurs

- `dedupeAffichage` est pure et totale (jamais d'exception sur des données valides). Une offre à champs nuls produit une empreinte partielle (`'|ville|'`) sans planter.

## Tests · `src/lib/offres/dedup-affichage.test.ts`

- Deux sources, même titre + ville + entreprise → **une** représentante, `plateformes` contient les deux libellés.
- Normalisation : `Diététicien H/F` et `DIETETICIEN (H/F)` (même ville + entreprise) → fusionnés.
- Villes différentes → **deux** cartes.
- Représentante : entre une offre sans coords et une avec coords (même empreinte), on garde celle **avec** coords.
- Ordre d'entrée préservé pour les représentantes.
- Offre à entreprise nulle : ne fusionne pas avec une offre à entreprise renseignée (même titre + ville).
