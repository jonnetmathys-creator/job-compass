# JobCompass · MVP Brique 5 : le Suivi des candidatures · Design

> Spec de conception. Brique 5 du MVP JobCompass. Prérequis : Briques 1 à 4 (dont la table `candidatures`) sur la branche `feat/mvp-4-candidature` / `main`.

## 1. Objectif

Offrir un **dashboard de suivi** simple et lisible des candidatures envoyées : une fois qu'on a postulé à une offre, on la marque « J'ai postulé », et elle apparaît dans `/suivi` où l'on suit son avancement (statut, relance, notes). But : ne plus perdre le fil de ses candidatures, savoir où l'on en est d'un coup d'œil.

Hors périmètre : rappels/notifications automatiques, emails de relance envoyés par l'app, statistiques avancées. On reste sur un tableau de bord clair et manuel.

## 2. Décisions (validées)

- **Déclencheur** : bouton **manuel** « J'ai postulé » sur la page candidature. Pas d'automatisme au clic « Postuler ».
- **Statuts** : `postulee` · `relancee` · `entretien` · `refusee` · `acceptee`. Le statut `brouillon` (candidature générée mais pas postulée) existe déjà et **n'apparaît pas** dans le suivi.
- **Affichage** : **sections par statut** (pas de kanban). En-tête type dashboard avec quelques compteurs.
- **Notes & relances** : chaque candidature a un champ **notes** libre et une **date de relance** optionnelle.
- **Design** : simple à comprendre, épuré, cohérent avec la DA existante (accent vert, cartes, Montserrat). Chaque statut a une couleur douce pour se repérer.

## 3. Modèle de données

Migration `0007_suivi.sql` : on enrichit la table `candidatures` existante.

```sql
alter table public.candidatures add column if not exists notes text;
alter table public.candidatures add column if not exists relance_le date;
alter table public.candidatures add column if not exists postulee_le date;
```

- Le champ `statut` (déjà présent, `text not null default 'brouillon'`) porte désormais le cycle : `brouillon` → `postulee` → `relancee` → `entretien` → `acceptee` / `refusee`.
- `postulee_le` : date à laquelle l'utilisateur a marqué « J'ai postulé » (date de candidature affichée dans le suivi).
- `relance_le` : date de relance prévue (optionnelle).
- `notes` : notes libres.

**Correctif indispensable** : `upsertCandidature` (dans `src/lib/candidature/lecture.ts`) écrit aujourd'hui `statut: 'brouillon'` à chaque appel. Or il est appelé à la génération ET à l'enregistrement des éditions. Résultat : enregistrer ou régénérer une candidature déjà postulée la ferait retomber en `brouillon` (sortie du suivi). On **retire `statut` du payload** d'`upsertCandidature` : à l'insertion, la valeur par défaut `brouillon` s'applique ; à la mise à jour, le statut existant est **préservé** (Postgres `ON CONFLICT DO UPDATE SET` ne touche que les colonnes fournies).

## 4. Parcours et écrans

### 4.1 Page candidature : bouton « J'ai postulé »

Sous le bloc « Postuler » de `/offre/[id]/candidature`, un encart de suivi :

- Si `statut === 'brouillon'` (pas encore postulée) : bouton **« J'ai postulé »**. Au clic → `statut = postulee`, `postulee_le = aujourd'hui`. L'encart passe à l'état « suivie ».
- Si déjà dans le suivi (`statut !== 'brouillon'`) : message **« Dans ton suivi ✓ »**, un lien **« Voir dans le suivi »** vers `/suivi`, et un bouton discret **« Retirer du suivi »** (repasse en `brouillon`, efface `postulee_le`).

L'éditeur reçoit désormais le `statut` initial (via `candidatureInitiale.statut`) pour afficher le bon état. Cet encart n'apparaît que lorsqu'une candidature existe (états d'édition), pas avant génération.

### 4.2 Page `/suivi` (dashboard)

- **En-tête** : titre « Suivi des candidatures » + une rangée de **compteurs** (cartes-chiffres) :
  - **En cours** = `postulee` + `relancee` + `entretien`
  - **Entretiens** = `entretien`
  - **Réponses** = `acceptee` + `refusee`
  - **Total** = toutes les candidatures suivies (statut ≠ `brouillon`)
- **Corps** : une **section par statut**, dans l'ordre `postulee`, `relancee`, `entretien`, `acceptee`, `refusee`. Chaque section affiche son libellé, sa pastille de couleur et le nombre d'éléments ; les sections vides sont masquées.
- **Carte de candidature** (dans une section) :
  - Titre de l'offre (lien vers `/offre/[id]`), employeur · ville.
  - Date de candidature (`postulee_le`).
  - **Sélecteur de statut** (pour faire avancer/changer le statut).
  - **Date de relance** (champ date, optionnel).
  - **Notes** (zone de texte, enregistrée à la sortie du champ).
- **État vide** (aucune candidature suivie) : message clair + lien vers la recherche (« Postule à une offre pour la retrouver ici »).
- **Accès** : lien « Suivi des candidatures » dans le menu compte (`compte-menu`) ; accès aussi depuis l'accueil (petit lien discret sous la barre de recherche).

### 4.3 Couleurs des statuts

Palette douce, cohérente avec la DA :

| Statut | Libellé | Couleur |
| --- | --- | --- |
| `postulee` | Postulée | bleu doux |
| `relancee` | Relancée | ambre doux |
| `entretien` | Entretien | violet doux |
| `acceptee` | Acceptée | vert (accent) |
| `refusee` | Refusée | rouge doux |

## 5. Logique et modules

### 5.1 Lecture · `src/lib/suivi/lecture.ts`

- `type StatutSuivi = 'postulee' | 'relancee' | 'entretien' | 'acceptee' | 'refusee'`
- `type CandidatureSuivi = { offre: OffreRow; statut: string; postulee_le: string | null; relance_le: string | null; notes: string | null }`
- `getSuivi(client, userId): Promise<CandidatureSuivi[]>` : lit les `candidatures` où `statut <> 'brouillon'`, jointes à `offres` (comme `getFavoris`), triées par `postulee_le` décroissant.

### 5.2 Server Actions · `src/lib/suivi/actions.ts`

- `marquerPostulee(offreId)` : `statut = 'postulee'`, `postulee_le = today` (n'écrase pas une date déjà posée). Auth requise, `revalidatePath('/suivi')`.
- `retirerDuSuivi(offreId)` : `statut = 'brouillon'`, `postulee_le = null`.
- `changerStatut(offreId, statut)` : met à jour le statut (valide contre la liste autorisée).
- `enregistrerSuivi(offreId, { notes, relance_le })` : met à jour notes et date de relance.

Toutes vérifient la session (`getServerClient` + `getUser`) et écrivent via un client qui respecte la RLS (policy `candidatures_self` déjà en place). La logique testable (client injecté) vit dans un module sans `'use server'` si besoin, comme pour la Brique 4.

### 5.3 Correctif `upsertCandidature`

Retirer `statut: 'brouillon'` du payload d'`upsertCandidature` (`src/lib/candidature/lecture.ts`). Ajuster le test associé si nécessaire (il ne doit plus attendre `statut` dans le payload).

## 6. Fichiers

**Données** : `supabase/migrations/0007_suivi.sql`.
**Logique** : `src/lib/suivi/lecture.ts`, `src/lib/suivi/actions.ts` (+ éventuel `src/lib/suivi/statuts.ts` pour la table libellés/couleurs partagée serveur/client).
**Écran** : `src/app/suivi/page.tsx` (serveur), `src/components/suivi-liste.tsx` (sections + compteurs), `src/components/suivi-carte.tsx` (carte éditable, client).
**Modifs** : `src/lib/candidature/lecture.ts` (upsert), `src/components/candidature-editor.tsx` (bouton « J'ai postulé » + réception du statut), `src/app/offre/[id]/candidature/page.tsx` (passe le statut), `src/components/compte-menu.tsx` (lien suivi), `src/app/page.tsx` (lien discret vers le suivi), `src/app/globals.css` (styles dashboard + pastilles statut).

## 7. Tests (Vitest)

- `upsertCandidature` : le payload **ne contient plus** `statut` (le statut existant est préservé à l'enregistrement).
- `getSuivi` : ne renvoie que les candidatures `statut <> 'brouillon'` de l'utilisateur, jointes aux offres, triées par date.
- `marquerPostulee` : passe `statut` à `postulee` et pose `postulee_le` ; `retirerDuSuivi` : repasse en `brouillon` et efface `postulee_le`.
- `changerStatut` : refuse un statut hors liste ; accepte un statut valide.
- `enregistrerSuivi` : écrit `notes` et `relance_le`.
- Rendu `suivi-liste` : compteurs corrects, sections vides masquées, état vide si aucune candidature.
- Rendu `suivi-carte` : affiche titre/employeur/date, sélecteur de statut, champ relance, notes ; changer le statut appelle l'action.

## 8. Gestion des erreurs et cas limites

- **Aucune candidature suivie** : état vide avec lien vers la recherche.
- **Offre supprimée** (FK `on delete cascade`) : la candidature disparaît proprement.
- **Échec d'une mise à jour** (statut/notes/relance) : message non bloquant, l'UI revient à l'état précédent.
- **Marquer « J'ai postulé » deux fois** : idempotent (ne réécrase pas `postulee_le`).
- **Statut invalide** envoyé à `changerStatut` : rejeté côté serveur.

## 9. Découpage en tâches (pour le plan)

1. Migration `0007_suivi` (notes, relance_le, postulee_le) + correctif `upsertCandidature` (retrait de `statut`) + ajustement du test. Tests.
2. `src/lib/suivi/statuts.ts` (libellés + couleurs + ordre + liste des statuts valides) + `src/lib/suivi/lecture.ts` (`getSuivi`). Tests.
3. Server Actions suivi (`marquerPostulee`, `retirerDuSuivi`, `changerStatut`, `enregistrerSuivi`). Tests avec faux client.
4. Bouton « J'ai postulé » dans `candidature-editor` (réception du statut, encart suivi) + passage du statut par la page candidature. Tests de rendu.
5. Page `/suivi` : `suivi-liste` (en-tête compteurs + sections par statut + état vide) + `suivi-carte` (carte éditable) + styles dashboard. Tests de rendu.
6. Accès : lien « Suivi des candidatures » dans `compte-menu` + lien discret sur l'accueil. Vérif build.
