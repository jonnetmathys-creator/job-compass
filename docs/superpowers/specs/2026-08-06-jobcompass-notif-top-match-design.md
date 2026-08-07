# Notif « top match » ≥ 90 (3b) · Design

**Goal :** mettre en avant les offres qui correspondent fortement au profil (score ≥ 90) dans la cloche et dans l'email d'alerte, avec un message explicite ("Une offre correspond à 94% à ton profil !").

**Architecture :** le moteur de scoring (3a) produit déjà les scores. On les joint à la boîte de la cloche (lecture) et à l'email d'alerte. On réordonne le cron pour que le scoring précède l'envoi de l'email, en séparant l'envoi de la collecte dans `refresh.ts`.

**Tech Stack :** TypeScript, Next.js 16, Supabase, Vitest.

## Global Constraints

- Jamais de tiret cadratin. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- Client service réservé au cron. `GEMINI_API_KEY` server-side (déjà en place via 3a).
- Logique en fonctions pures testables ; I/O en enveloppes injectables.
- Commits terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commits locaux uniquement.

## Décisions validées

- Seuil « top match » : **≥ 90** (réutilise `estTopMatch`).
- Cloche : chaque nouvelle offre affiche son score ; une offre ≥ 90 est mise en avant (pastille + message).
- Email : offres **triées par score décroissant**, `%` affiché par offre, **message de tête** s'il existe une offre ≥ 90.

## Composant · cloche

- `src/lib/alertes/boite.ts` : `getBoite` joint les scores. Après avoir chargé les nouvelles offres, appeler `getScores(client, userId, offreIds)` (déjà écrit en 3a) et fusionner. Le type `NouvelleOffre` gagne `score?: number` et `raison?: string | null`.
- `src/components/cloche-notifs.tsx` : pour chaque item, si `score` défini, afficher une pastille `{score}%` colorée (`couleurScore`). Si `estTopMatch(score)`, ajouter une classe `top-match` et une ligne message ("Correspond à {score}% à ton profil"). Les items ≥ 90 sont remontés en tête de la liste « Nouvelles offres ».
- Style : pastille de score dans l'item + surbrillance discrète des `top-match` (`src/app/globals.css`).

## Composant · email

- `src/lib/alertes/email.ts` :
  - `envoyerAlerte` charge aussi les scores des `offreIds` (via `getScores` avec le client service) et les passe à `buildEmailHtml`.
  - `buildEmailHtml(intitule, offres, baseUrl)` : `offres` porte désormais un `score?: number`. Trie par score décroissant (offres sans score en fin), affiche le `%` à côté de chaque titre, et si au moins une offre a `score ≥ 90`, insère en tête un bandeau : « Une offre correspond à {maxScore}% à ton profil ! ». Sujet enrichi : `🎯 Top match ({maxScore}%) · {intitule}` quand une offre ≥ 90 existe, sinon le sujet actuel.
- Fonction pure `bandeauTopMatch(offres) => { top: boolean; maxScore: number }` testable.

## Composant · réagencement du cron

Objectif : ordre **collecte → score → email** (aujourd'hui l'email part avant le score).

- `src/lib/alertes/refresh.ts` :
  - `rafraichirEtEnregistrer(client, recherche, deps)` ne fait plus l'email : il renvoie `{ nouvelles: number; ids: string[] }` (nb enregistré + ids des offres nouvelles).
  - Nouvelle fonction `envoyerAlerteSiActive(client, recherche, ids, deps) => Promise<boolean>` : si `alertes_email` et `ids.length > 0`, résout le destinataire (lookup admin best-effort) et appelle `envoyerAlerte` ; sinon `false`.
- `src/app/api/refresh/route.ts` · `traiter`, par recherche :
  1. `{ nouvelles, ids } = await rafraichirEtEnregistrer(client, r)` ; `nouvelles += ...`
  2. `scores += await scorerPourRecherche(client, r)` (try/catch, inchangé)
  3. `if (await envoyerAlerteSiActive(client, r, ids)) emails += 1`

## Gestion d'erreurs

- Échec de `getScores` dans la cloche ou l'email : on continue sans score (offres affichées/envoyées sans `%`), jamais bloquant.
- Réordonnancement : le scoring reste encapsulé `try/catch` ; s'il échoue, l'email part quand même (sans `%`).

## Tests

- `bandeauTopMatch` : détecte une offre ≥ 90 et renvoie le max ; aucune ≥ 90 → `top: false`.
- `buildEmailHtml` : tri par score décroissant ; bandeau présent si ≥ 90, absent sinon ; `%` affiché.
- `getBoite` : fusionne les scores dans les items (client mocké avec `nouvelles_offres` + `scores`).
- `refresh` (`rafraichirEtEnregistrer` + `envoyerAlerteSiActive`) : la collecte n'envoie plus l'email ; l'email n'est envoyé que si `alertes_email` et `ids` non vides ; l'ordre collecte → score → email est respecté dans `traiter` (test d'intégration léger avec deps mockées si praticable, sinon tests unitaires des deux fonctions).
