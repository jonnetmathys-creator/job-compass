# Scoring IA des offres (3a : moteur + affichage) · Design

**Goal :** attribuer à chaque offre un score de pertinence 0-100 par rapport au CV de l'utilisateur, calculé en arrière-plan (Gemini par lots), et l'afficher directement sur chaque carte d'offre avec la raison au survol, plus un tri par pertinence. Aucun clic requis : le score est déjà là.

**Architecture :** le CV (PDF) est transcrit une fois en texte et mis en cache (`profils.cv_texte`). Le cron `/api/refresh`, après la collecte, note les offres non encore notées de chaque utilisateur : dédoublonnage par empreinte (pour ne pas noter deux fois le même poste), envoi par lots de ~20 à Gemini (`appelerGeminiJson`), stockage dans une table `scores`. Les résultats joignent les scores de l'utilisateur et la carte affiche un badge.

**Tech Stack :** TypeScript, Next.js 16, Supabase, Gemini (`gemini-flash-latest`), Vitest.

## Global Constraints

- Jamais de tiret cadratin. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- `GEMINI_API_KEY` reste server-side ; le scoring tourne dans le cron via le client service (contourne la RLS pour écrire les scores).
- Logique métier en fonctions pures testables ; les I/O (Supabase, Gemini) en enveloppes fines et injectables (`deps.fetchImpl`, dépendances mockables).
- Modèle Gemini : `gemini-flash-latest` (quota gratuit), via l'existant `appelerGeminiJson`.
- Commits terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commits locaux uniquement.

## Décisions validées

- Tri par défaut : **par date** (score en info) ; bouton pour trier **par pertinence**.
- **Raison affichée** : une phrase courte, dans une box au survol du score.
- Badge = **le pourcentage seul** (pas de texte "pour toi").
- Couleur **continue rouge → vert** selon le score (rouge en bas, vert `≥ 90`), calculée depuis le score (teinte HSL), pour un rendu net et joli · pas de tendance vers le gris.
- Score `≥ 90` : **aura animée** discrète (pulsation, dans l'esprit de l'animation de la cloche).
- Le score est **par utilisateur** (dépend de son CV).

## Modèle de données · migration `0012_scores.sql`

```sql
alter table public.profils add column if not exists cv_texte text;

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

Écriture réservée au client service (cron). Suppression en cascade avec l'offre (la purge nettoie donc aussi les scores).

## Composant · transcription du CV : `src/lib/scoring/cv.ts`

- `transcrirePdf(base64: string, deps?) => Promise<string>` : ajoute dans `gemini.ts` un appel `generateContent` (PDF en `inline_data` + consigne "transcris ce PDF en texte brut, sans commentaire"), renvoie le texte. `fetchImpl` injectable.
- `assurerCvTexte(client, userId, profil, deps?) => Promise<string | null>` :
  - `profil.cv_texte` présent → le renvoyer ;
  - sinon `profil.cv_url` présent → télécharger le PDF, `transcrirePdf`, écrire `profils.cv_texte`, renvoyer le texte ;
  - sinon (pas de CV) → `null`.
- Invalidation : dans `uploadCv` (`src/lib/profil.ts`), passer `cv_texte: null` lors de l'upsert, pour forcer une ré-extraction au prochain cron quand l'utilisateur change de CV.

## Composant · notation par lots : `src/lib/scoring/scorer.ts`

Types :
```ts
type OffreANoter = { ref: string; titre: string; entreprise: string | null; ville: string | null; contrat: string | null; description: string | null }
type Note = { ref: string; score: number; raison: string }
```

- `construirePromptScoring(cvTexte, offres) => string` (pur) : consigne + CV + liste des offres (avec leur `ref`). Demande un score 0-100 de correspondance CV↔offre et une raison d'une phrase, en français.
- `TAILLE_LOT = 20`.
- `scorerLot(cvTexte, offres, deps?) => Promise<Note[]>` : un appel `appelerGeminiJson` avec un schéma tableau `[{ ref, score, raison }]`. `score` borné 0-100 côté lecture (clamp défensif).
- `scorerOffres(cvTexte, offres, deps?) => Promise<Note[]>` : découpe en lots de 20, concatène les notes. Un lot en échec est loggé et ignoré (les autres passent).

## Composant · intégration cron : `src/lib/scoring/execution.ts`

- `scorerPourRecherche(client, recherche, deps?) => Promise<number>` (client = service) :
  1. `profil` de `recherche.user_id` (`cv_url`, `cv_texte`) ; `cvTexte = assurerCvTexte(...)`. Si `null` → retour `0` (pas de CV).
  2. Lire les offres liées à la recherche (jointure `resultats → offres`, colonnes utiles) **sans score** pour cet utilisateur (anti-jointure via les `offre_id` déjà dans `scores`).
  3. Dédoublonner par empreinte (réutiliser la normalisation du dédup) : on note une offre par groupe.
  4. `scorerOffres(cvTexte, ...)` ; réétaler le score de chaque groupe sur **tous** les `offre_id` du groupe.
  5. Upsert dans `scores` (`onConflict user_id,offre_id`, `ignoreDuplicates`). Retour : nombre de scores écrits.
- Branché dans `traiter` (`/api/refresh`) après `rafraichirEtEnregistrer`, par recherche, encapsulé `try/catch` (un échec de scoring ne bloque ni la collecte ni les alertes). Le total `scores` est ajouté à la réponse JSON du cron.

Réutilisation de l'empreinte : extraire la normalisation de `dedup-affichage.ts` dans un helper partagé `empreinteOffre(o)` importable par le scoring, sans dupliquer la logique.

## Composant · lecture et affichage

- `src/lib/scoring/lecture.ts` : `getScores(client, userId, offreIds) => Promise<Map<string, { score: number; raison: string | null }>>` (clamp du score à 0-100).
- `src/app/recherche/[id]/page.tsx` : après `dedupeAffichage`, charger les scores de l'utilisateur pour les `offre_id` affichés et fusionner (`{ ...offre, score, raison }`). Le type d'affichage devient `OffreAffichee & { score?: number; raison?: string | null }`.
- `OffreCard` : si `score` défini, afficher un badge **"{score}%"**. Sa couleur est calculée depuis le score sur une échelle rouge → vert (teinte HSL `hue = score × 1.2`, soit 0 = rouge à 120 = vert), appliquée en style inline pour un dégradé continu. Un score `≥ 90` reçoit en plus la classe `.match-top` qui ajoute une **aura pulsée** (box-shadow animé, comme la cloche). Au survol du badge, une **box** affiche la `raison`.
- Helper pur `couleurScore(score) => string` (teinte HSL) et `estTopMatch(score) => boolean` (≥ 90), testables.
- Tri : dans `ResultatsShell`, un bouton **"Trier par pertinence"** (état local) réordonne `visibles` par `score` décroissant (offres sans score en fin) ; par défaut, tri par date (ordre serveur) inchangé.

## Gestion d'erreurs

- Pas de CV → aucun score (aucun badge), le reste fonctionne normalement.
- Gemini indisponible / lot en échec → loggé, les offres restent simplement non notées, re-tentées au prochain cron.
- Score hors bornes renvoyé par Gemini → clampé 0-100 à la lecture.

## Tests

- `construirePromptScoring` : contient le CV et chaque `ref`.
- `scorerOffres` : `appelerGeminiJson` mocké → découpe en lots de 20, concatène ; un lot en échec est ignoré, les autres notes reviennent.
- `assurerCvTexte` : cache présent → pas d'extraction ; cache absent + `cv_url` → extraction + écriture ; pas de CV → `null`.
- `scorerPourRecherche` : dédoublonne avant notation (une offre par groupe envoyée), réétale le score sur tous les `offre_id` du groupe, upsert appelé avec les bonnes lignes (client + Gemini mockés).
- `getScores` : clamp 0-100 ; map correcte.
- Affichage : `couleurScore(score)` renvoie une teinte rouge pour un score bas et verte pour un score haut ; `estTopMatch(score)` vrai `≥ 90`, faux en dessous.

## Hors périmètre (sous-projet 3b)

- Mise en avant des offres `≥ 90` dans la cloche et l'email d'alerte ("Une offre correspond à 94% !"). Le moteur de 3a produit déjà les scores nécessaires.
