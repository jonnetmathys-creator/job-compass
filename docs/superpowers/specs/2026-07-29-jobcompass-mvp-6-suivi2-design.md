# JobCompass · MVP Brique 6 : Suivi 2.0 (relance, ajout manuel, flow clair) · Design

> Spec de conception. Brique 6 du MVP JobCompass. Prérequis : Briques 1 à 5 (dont la table `candidatures` + le dashboard `/suivi`) sur `feat/mvp-4-candidature`.

## 1. Objectif

Rendre le suivi des candidatures **simple, logique et complet** :
1. Marquer une offre « postulée » d'un geste clair, **directement depuis la page de l'offre** (plus besoin de générer une candidature IA d'abord).
2. **Ajouter manuellement** une candidature pour une offre trouvée ailleurs que sur France Travail.
3. **Suivre les dates** : date de candidature, **date de relance conseillée automatiquement** (+10 jours), badge « À relancer » quand le délai est dépassé sans réponse.
4. **Générer et enregistrer un mail de relance** par l'IA, prêt à copier/envoyer.
5. Un **dashboard plus lisible** : « postulé il y a X jours », statut clair, prochaine action évidente, section « À relancer » mise en avant.

Hors périmètre : notifications/emails automatiques envoyés par l'app (on reste sur du manuel assisté), synchronisation avec une boîte mail.

## 2. Décisions (validées)

- **Déclencheur postulé** : bouton « J'ai postulé » primaire sur la **page offre** ET sur la page candidature, indépendant de l'IA. Il crée la candidature dans le suivi si elle n'existe pas encore.
- **Délai de relance** : **10 jours** après la date de candidature (modifiable par candidature).
- **Ajout manuel** : formulaire avec **intitulé, entreprise, ville, lien, date de candidature**.
- **Mail de relance IA** : bouton sur la carte de suivi → génère un mail de relance court, **enregistré** (récupérable), éditable et copiable.
- **Design** : simple, clair, cohérent DA (accent vert, cartes, pastilles de statut existantes).

## 3. Modèle de données

Migration `0008_suivi2.sql` :

```sql
-- Mail de relance généré par l'IA, enregistré par candidature.
alter table public.candidatures add column if not exists relance_objet text;
alter table public.candidatures add column if not exists relance_corps text;

-- Candidatures manuelles : autoriser un utilisateur authentifié à insérer
-- une offre « manuelle » (offre hors France Travail qu'il saisit lui-même).
-- Les offres collectées restent écrites par le service role (bypass RLS).
create policy offres_insert_manuelle on public.offres
  for insert to authenticated
  with check (source = 'manuelle');
```

- Une **candidature manuelle** = une ligne `offres` avec `source = 'manuelle'`, `source_id` = uuid généré, `titre`/`entreprise`/`ville`/`url_postuler` saisis par l'utilisateur (le reste `null`), plus une ligne `candidatures` (`statut = 'postulee'`). Cela réutilise tout l'existant : la jointure `getSuivi`, la carte, la page `/offre/[id]`.
- `relance_le` (déjà présent) porte la **date de relance conseillée** : posée automatiquement à `postulee_le + 10 jours` lors du passage en « postulée », modifiable ensuite par l'utilisateur.
- `postulee_le` (déjà présent) = date de candidature.
- `relance_objet` / `relance_corps` = mail de relance IA enregistré.

## 4. Parcours et écrans

### 4.1 Marquer « postulé » (page offre + candidature)

- **Page offre** (`/offre/[id]`) : un bouton primaire **« J'ai postulé »**. Au clic → la candidature entre dans le suivi (`statut = postulee`, `postulee_le = aujourd'hui`, `relance_le = +10 jours`). Si aucune candidature n'existe encore pour cette offre, elle est **créée** (une candidature « vide » de contenu IA, uniquement suivi). Le bouton devient alors **« Postulé ✓ · Voir le suivi »** avec une option **« Annuler »** (retire du suivi).
- **Page candidature** : l'encart « J'ai postulé » existant reste, avec le même comportement (déjà en place, on l'harmonise visuellement).
- La page offre charge donc le statut de suivi de la candidature (le cas échéant) pour afficher le bon état.

### 4.2 Dashboard `/suivi` (refonte lisibilité)

- **En-tête** : titre + compteurs (Total · En cours · Entretiens · Réponses), inchangés, + un **bandeau « À relancer »** s'il y a des candidatures à relancer (nombre + accès rapide).
- **Bouton « + Ajouter une candidature »** en évidence : ouvre un formulaire (intitulé, entreprise, ville, lien, date) qui crée une candidature manuelle (statut `postulee`).
- **Sections par statut** (postulee, relancee, entretien, acceptee, refusee), sections vides masquées.
- **Carte de candidature** (refonte) :
  - Titre (lien vers l'offre : `/offre/[id]` pour les offres FT, lien externe pour une manuelle avec URL), employeur · ville.
  - **« Postulé il y a X jours »** (calculé depuis `postulee_le`).
  - **Statut** (sélecteur) et, pour les candidatures encore en attente : l'info de relance (**« Relance conseillée le … »**, badge **« À relancer »** si `aujourd'hui ≥ relance_le` et statut `postulee`).
  - **Notes** (édition à la volée, déjà en place) + **date de relance** modifiable.
  - **« Générer un mail de relance »** (IA) : génère, enregistre et affiche le mail (objet + corps), éditable et copiable ; un bouton **« J'ai relancé »** passe le statut à `relancee`.
  - **Supprimer** la candidature du suivi (bouton discret) : supprime la ligne `candidatures` (et, si offre manuelle, la ligne `offres` associée).

### 4.3 « À relancer »

Une candidature est « à relancer » si `statut = 'postulee'` et `relance_le` non nul et `relance_le ≤ aujourd'hui`. Le dashboard met ces cartes en avant (badge sur la carte + bandeau compteur en tête). Passer le statut à `relancee` (ou plus loin) la retire des « à relancer ».

## 5. Logique et modules

### 5.1 Écriture (extension de `src/lib/suivi/lecture.ts`)

- `setPostulee(client, userId, offreId, dateIso, relanceIso)` devient **create-or-update** : garantit l'existence de la ligne `candidatures` (upsert insert-or-ignore), promeut `brouillon → postulee`, pose `postulee_le`/`relance_le` si absents. `relanceIso` = `dateIso + 10 jours`.
- `supprimerCandidature(client, userId, offreId)` : supprime la ligne `candidatures` ; si l'offre est `source = 'manuelle'` et n'est plus référencée, supprime aussi la ligne `offres`.
- `setRelanceEmail(client, userId, offreId, { objet, corps })` : enregistre le mail de relance.
- `getSuivi` : ajouter `relance_objet, relance_corps` aux colonnes lues ; le type `CandidatureSuivi` gagne ces champs.

### 5.2 Candidature manuelle (`src/lib/suivi/manuelle.ts`)

- `creerCandidatureManuelle(client, userId, { titre, entreprise, ville, url, dateIso })` :
  1. insère une ligne `offres` (`source='manuelle'`, `source_id = crypto.randomUUID()`, `titre`, `entreprise`, `ville`, `url_postuler = url`), récupère son `id` ;
  2. insère une ligne `candidatures` (`statut='postulee'`, `postulee_le=dateIso`, `relance_le=dateIso+10j`) ;
  3. renvoie l'`offreId`.

### 5.3 Mail de relance (`src/lib/suivi/relance.ts`)

- `buildPromptRelance(offre, profil, emailInitial)` (pur) : consigne un mail de relance **court, poli, professionnel**, rappelant la candidature initiale, sans relancer de façon insistante.
- Réutilise l'appel Gemini via une fonction JSON générique `appelerGeminiJson(prompt, schema, deps)` ajoutée à `src/lib/candidature/gemini.ts` (texte seul, sans PDF), renvoyant `{ objet, corps }`.
- `genererRelance` (Server Action) : charge candidature + offre + profil, construit le prompt, appelle Gemini, enregistre via `setRelanceEmail`, renvoie `{ objet, corps }`.

### 5.4 Server Actions (`src/lib/suivi/actions.ts`)

Ajouts : `ajouterCandidatureManuelle(form)`, `supprimerCandidature(offreId)`, `genererRelance(offreId)`, `enregistrerRelance(offreId, { objet, corps })`, `marquerRelance(offreId)` (= `changerStatut(offreId, 'relancee')`, ou réutilise `changerStatut`). `marquerPostulee` passe `relanceIso = today + 10j`.

### 5.5 Dates (`src/lib/suivi/dates.ts`)

- `ajouterJours(dateIso, n): string` (pur) : renvoie la date ISO (yyyy-mm-dd) décalée de `n` jours.
- `joursDepuis(dateIso, todayIso): number` (pur) : nombre de jours écoulés.
- `estARelancer(statut, relanceLe, todayIso): boolean` (pur).
- Le `today` est injecté (paramètre) pour la testabilité ; côté serveur/UI on passe `new Date()`.

## 6. Fichiers

**Données** : `supabase/migrations/0008_suivi2.sql`.
**Logique** : `src/lib/suivi/dates.ts`, `src/lib/suivi/manuelle.ts`, `src/lib/suivi/relance.ts` ; extensions de `src/lib/suivi/{lecture,actions}.ts` ; ajout `appelerGeminiJson` à `src/lib/candidature/gemini.ts`.
**Écrans** : `src/components/postuler-toggle.tsx` (bouton « J'ai postulé » réutilisable, offre + candidature), `src/components/ajout-candidature.tsx` (formulaire manuel), refonte `src/components/suivi-carte.tsx` (jours, relance, mail de relance, suppression), `src/components/suivi-liste.tsx` (bandeau « à relancer » + bouton ajouter).
**Modifs** : `src/components/offre-detail.tsx` (bouton « J'ai postulé »), `src/app/offre/[id]/page.tsx` (charge le statut de suivi), `src/components/candidature-editor.tsx` (réutilise `PostulerToggle` pour cohérence).

## 7. Tests (Vitest)

- `dates` : `ajouterJours`, `joursDepuis`, `estARelancer` (avant/après échéance, statut non postulee).
- `setPostulee` : crée la ligne si absente, promeut brouillon→postulee, pose postulee_le et relance_le (+10j) si null, ne réécrase pas des dates existantes.
- `creerCandidatureManuelle` : insère l'offre manuelle puis la candidature avec les bonnes valeurs.
- `supprimerCandidature` : supprime la candidature ; supprime l'offre si manuelle.
- `getSuivi` : renvoie aussi `relance_objet`/`relance_corps`.
- `buildPromptRelance` : contient l'employeur, le nom, une consigne « relance courte / polie ».
- `appelerGeminiJson` (fetch mocké) : bon endpoint + schéma, résultat parsé.
- `genererRelance` (faux client) : appelle Gemini et enregistre le résultat.
- Rendu `PostulerToggle` : état « J'ai postulé » vs « Postulé ✓ » selon le statut ; clic appelle l'action.
- Rendu `AjoutCandidature` : champs présents ; soumission appelle l'action avec le bon payload.
- Rendu `SuiviCarte` : « postulé il y a X jours », badge « à relancer » quand échu, bouton « Générer un mail de relance », suppression.

## 8. Gestion des erreurs et cas limites

- **Marquer postulé sans candidature existante** : la ligne est créée (offre déjà en base côté FT ; pour une manuelle, l'offre est créée d'abord).
- **Double clic « J'ai postulé »** : idempotent (ne réécrase pas `postulee_le`).
- **Générer une relance sans profil complet** : la relance ne dépend pas des PDF (texte seul) ; si le nom manque, on reste générique.
- **Échec Gemini / quota** : message non bloquant ; le mail de relance déjà enregistré reste intact.
- **Suppression d'une candidature manuelle** : supprime aussi l'offre orpheline ; une offre FT n'est jamais supprimée.
- **Offre manuelle sans URL** : le titre n'est pas un lien (texte simple).
- **Statut invalide** : rejeté côté serveur (déjà en place).

## 9. Découpage en tâches (pour le plan)

1. `dates.ts` (ajouterJours, joursDepuis, estARelancer) + migration `0008` (relance_objet/corps + policy insert offres manuelle). Tests.
2. `setPostulee` create-or-update + `relance_le` auto (+10j) ; `marquerPostulee` passe la date de relance. Tests.
3. Candidature manuelle : `creerCandidatureManuelle` + action `ajouterCandidatureManuelle` + `supprimerCandidature`. Tests.
4. Relance IA : `appelerGeminiJson` (gemini.ts) + `buildPromptRelance` + `genererRelance`/`enregistrerRelance` actions + `setRelanceEmail` + `getSuivi` élargi. Tests.
5. `PostulerToggle` (composant réutilisable) + intégration page offre (charge le statut) + harmonisation dans l'éditeur candidature. Tests.
6. Refonte `SuiviCarte` (jours depuis, relance conseillée + badge à relancer, bloc mail de relance, suppression) + `SuiviListe` (bandeau à relancer + `AjoutCandidature`) + styles. Tests. Build.
