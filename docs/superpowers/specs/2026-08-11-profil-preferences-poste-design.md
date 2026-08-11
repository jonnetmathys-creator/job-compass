# Refonte profil + préférences de poste

**Date :** 2026-08-11
**Objectif :** Refondre la page profil en bento (proposition 3 validée) et ajouter des préférences de poste que l'utilisateur sélectionne en chips, préférences qui affinent le score IA.

## Contexte

- La page profil (`src/app/profil/page.tsx` + `profil-form.tsx`) mélange aujourd'hui du Tailwind brut, peu cohérent avec le design system du site (`.side-card`, `.btn-primary`, tokens CSS). On unifie.
- Le scoring IA (`src/lib/scoring/scorer.ts` → `construirePromptScoring`) n'utilise que le texte du CV. On y injecte les préférences.
- Table `profils` : `user_id, nom, titre_recherche, cv_url, cv_texte, lettre_base, lettre_url, updated_at`. Dernière migration : `0013`.
- Le scoring est déclenché par `scorerPourRecherche` (cron + recherches interactives). Les scores sont mis en cache dans la table `scores (user_id, offre_id, score, raison)` et seules les offres non notées sont (re)notées.

## Décisions validées

- **Taxonomie** : 4 groupes (voir ci-dessous), valeurs figées.
- **Effet scoring** : pondération douce (jamais de masquage ni de 0 pour un simple écart de préférence ; le CV reste le critère principal).
- **Recalcul** : à l'enregistrement, si les préférences ont changé, on purge les scores en cache de l'utilisateur → recalcul au prochain rafraîchissement / recherche.
- **CV requis** : comportement inchangé, pas de CV = pas de score, même avec des préférences.
- **Layout** : proposition 3 (cartes bento). Ordinateur : Identité + Documents en tête, Préférences en bandeau large dessous, Alertes + Offres likées, puis Enregistrer. Mobile : une colonne, ordre Identité → Préférences → Documents → Alertes → Enregistrer → Offres likées.

## Taxonomie des préférences

Fichier `src/lib/preferences.ts`. On stocke des **clés stables** ; les libellés servent à l'affichage et à l'injection dans le prompt.

```ts
export type GroupePref = { titre: string; options: { cle: string; label: string }[] }

export const PREFERENCES: GroupePref[] = [
  { titre: "Cadre d'exercice", options: [
    { cle: 'liberal', label: 'Libéral / cabinet' },
    { cle: 'hopital_chu', label: 'Hôpital / CHU' },
    { cle: 'clinique', label: 'Clinique' },
    { cle: 'ehpad', label: 'EHPAD / gériatrie' },
    { cle: 'restauration_collective', label: 'Restauration collective' },
    { cle: 'industrie_agro', label: 'Industrie agroalimentaire' },
    { cle: 'sante_publique', label: 'Santé publique / prévention' },
    { cle: 'nutrition_sport', label: 'Nutrition du sport' },
    { cle: 'enseignement', label: 'Enseignement / recherche' },
  ]},
  { titre: 'Type de contrat', options: [
    { cle: 'cdi', label: 'CDI' },
    { cle: 'cdd', label: 'CDD' },
    { cle: 'liberal_independant', label: 'Libéral / indépendant' },
    { cle: 'interim', label: 'Intérim / vacation' },
    { cle: 'stage', label: 'Stage' },
    { cle: 'alternance', label: 'Alternance' },
  ]},
  { titre: 'Temps de travail', options: [
    { cle: 'temps_plein', label: 'Temps plein' },
    { cle: 'temps_partiel', label: 'Temps partiel' },
  ]},
  { titre: 'Organisation', options: [
    { cle: 'presentiel', label: 'Présentiel' },
    { cle: 'teletravail', label: 'Télétravail possible' },
  ]},
]

// Toutes les clés valides (pour valider les entrées et mapper clé -> libellé).
export const LABEL_PAR_CLE: Record<string, string> // dérivé de PREFERENCES
export function clesVersLabels(cles: string[]): string[] // ignore les clés inconnues
```

## Modèle de données

- Migration `supabase/migrations/0014_preferences.sql` :
  ```sql
  alter table profils add column if not exists preferences text[] not null default '{}';
  ```
- Type `Profil` (`src/lib/profil.ts`) : ajouter `preferences: string[]`.
- `getProfil` fait déjà `select('*')`, donc `preferences` remonte. Les profils existants renvoient `[]` (défaut).

## Intégration au scoring (pondération douce)

- `construirePromptScoring(cvTexte, offres, preferences?: string[])` : si `preferences` non vide, insérer un bloc AVANT la liste des offres :
  > Préférences du candidat (ce qu'il privilégie) : {libellés joints par « , »}.
  > Montez le score des offres qui correspondent à ces préférences et baissez-le pour celles qui s'en éloignent. N'excluez JAMAIS une offre et ne mettez pas 0 uniquement à cause d'un écart de préférence : le CV reste le critère principal.
- `scorerOffres(cvTexte, offres, preferences?, deps?)` : transmet `preferences` à `construirePromptScoring` pour chaque lot.
- `scorerPourRecherche` (`src/lib/scoring/execution.ts`) : lit `profil.preferences`, le convertit en libellés via `clesVersLabels`, et le passe à `scorerOffres`. CV toujours requis (garde `assurerCvTexte` ; pas de CV → 0, inchangé).

## Enregistrement + recalcul auto

Nouvelle action serveur `src/app/profil/actions.ts` :

```ts
'use server'
export async function enregistrerProfil(patch: {
  nom: string | null; titre_recherche: string | null; preferences: string[]
}): Promise<{ ok: boolean; erreur?: string }>
```

Comportement :
1. `getServerClient()` + `auth.getUser()` ; sans user → `{ ok: false, erreur: 'Non authentifié' }`.
2. Lire les préférences actuelles (`getProfil`).
3. Ne conserver que les clés valides de `patch.preferences` (filtre via `LABEL_PAR_CLE`), dédupliquées.
4. `upsertProfil(client, user.id, { nom, titre_recherche, preferences })`.
5. Si l'ensemble des préférences a changé (comparaison ordre-insensible : tri + jointure), purger le cache de scores : `getServiceClient().from('scores').delete().eq('user_id', user.id)`, en `try/catch` (échec non bloquant, `console.error`).
6. `revalidatePath('/profil')` ; retourner `{ ok: true }`.

Le service client est utilisé pour la purge afin de ne pas dépendre d'une règle RLS de suppression sur `scores`.

## Refonte UI (bento, proposition 3)

Nouveau composant client `src/components/profil-bento.tsx` : reçoit `initial: Profil` et `alertes`, rend toute la grille.

- Conteneur `<form className="profil-bento">` (grille CSS). Bouton Enregistrer `type="submit"` qui appelle `enregistrerProfil({ nom, titre_recherche, preferences })`. État `saved` / `erreur` (pattern existant).
- Tuiles :
  - **Identité** : Nom, Titre recherché (inputs contrôlés, style `.field` du site).
  - **Préférences de poste** : composant `PreferencesSelector` (voir plus bas). Texte d'aide « Aident l'IA à mieux noter vos offres. »
  - **Documents** : upload CV + Lettre, immédiats via `getBrowserClient` + `uploadCv`/`uploadLettre` (logique existante conservée), avec indicateur du fichier courant + libellé « Remplacer » / « Ajouter ».
  - **Alertes email** : rend `<AlertesProfil alertes={alertes} />` (inchangé). Ses contrôles restent `type="button"`, donc l'imbrication dans le `<form>` est sûre.
  - **Offres likées** : lien vers `/favoris` (repris de l'actuel).
  - **Enregistrer** + « Enregistré ✓ ».
  - `OnboardingRejouer` : rendu à l'intérieur de la tuile Alertes, sous `AlertesProfil`, séparé par un filet (comportement inchangé, comme aujourd'hui).
- Grille (aligne sur le breakpoint 768 px du site) :
  - Au-dessus de 768 px : `grid-template-columns: 1fr 1fr` avec zones `"id docs" "pref pref" "alertes likes" "save save"`.
  - `max-width: 768px` : une colonne, ordre Identité, Préférences, Documents, Alertes, Enregistrer, Offres likées (via `grid-template-areas` mono-colonne ou `order`).

Composant `src/components/preferences-selector.tsx` (client) :
- Props : `value: string[]`, `onChange: (next: string[]) => void`.
- Rend chaque groupe de `PREFERENCES` : titre de sous-section + chips.
- Chips = `<button type="button" aria-pressed>` togglant la clé (ajout/retrait), classe `.pref-chip` / `.pref-chip.on`, taille tactile ≥ 40 px sur mobile.

Page `src/app/profil/page.tsx` : garde le `PageHeader` et l'en-tête (avatar + « Mon profil » + email), puis rend `<ProfilBento initial={initial} alertes={alertes} />`. Retire l'ancien empilement de `.side-card`.

CSS (`src/app/globals.css`) : ajouter `.profil-bento`, `.p-tile`, `.p-tile-lbl`, `.pref-subhead`, `.pref-chip(.on)`, l'aération libellé→chips validée sur la maquette, et le passage 1 colonne / 2 colonnes. Réutiliser les tokens (`--accent`, `--accent-soft`, `--line`, `--radius`, `--shadow-sm`).

## Gestion des erreurs

- Échec d'enregistrement du profil → message d'erreur sous le bouton (pattern existant), pas de crash.
- Échec d'upload CV/lettre → message dédié (existant).
- Échec de purge des scores → `console.error`, non bloquant (l'enregistrement du profil reste un succès).
- Clés de préférences inconnues → ignorées silencieusement (filtre serveur).

## Tests

- `src/lib/preferences.test.ts` : toutes les clés uniques ; `clesVersLabels` mappe et ignore les clés inconnues.
- `src/lib/scoring/scorer.test.ts` : `construirePromptScoring` inclut le bloc « Préférences du candidat » quand des préférences sont fournies, et ne l'inclut pas sinon.
- `src/app/profil/actions.test.ts` : `enregistrerProfil` purge `scores` quand les préférences changent, ne purge pas quand elles sont identiques (ordre différent = identique), clients mockés.
- `src/components/preferences-selector.test.tsx` : cliquer une chip l'active et rappelle `onChange` avec la clé ; recliquer la retire.
- Les tests existants (`profil.test.ts`, scoring) restent verts.

## Hors périmètre

- Pas de bouton « recalculer maintenant » (le recalcul se fait au prochain rafraîchissement / recherche ; on pourra l'ajouter plus tard).
- Pas de filtrage strict par préférences (pondération douce uniquement).
- Pas de scoring sans CV.
- Pas de nouvelle gestion des alertes (composant `AlertesProfil` inchangé).
