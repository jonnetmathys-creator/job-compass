# JobCompass · MVP Brique 7 : Alertes & nouvelles offres · Design

> Spec de conception. Brique 7 du MVP JobCompass. Prérequis : Briques 1 à 6 sur `feat/mvp-4-candidature`.

## 1. Objectif

Prévenir l'utilisateur quand de **nouvelles offres** apparaissent pour ses recherches :
1. Une **cloche** en haut à droite (à côté du compte) avec le **nombre de nouvelles offres non vues** en rouge.
2. Une **boîte de réception** (au clic sur la cloche) listant les nouvelles offres ; la pastille **décroît au fur et à mesure que chaque offre est consultée** et disparaît quand tout est vu.
3. Les entrées **expirent au bout de 24 h**.
4. Un petit bouton **« Alertes mail »** activable **par recherche** sur la page résultats : si activé, l'utilisateur reçoit les nouvelles offres par **email** (via Resend, offre gratuite).

Hors périmètre : configuration DNS/domaine Resend (l'utilisateur la fera pour l'envoi en production ; en test on envoie depuis l'adresse d'onboarding Resend vers sa propre adresse).

## 2. Réalité technique (à garder en tête)

Pour que de « nouvelles offres » apparaissent, il faut **re-collecter** périodiquement les recherches (l'API France Travail publie de nouvelles offres au fil du temps). Deux déclencheurs :
- **Manuel / cron** : un endpoint protégé `POST /api/refresh` relance la collecte d'une recherche (ou de toutes), détecte les nouvelles offres, remplit la boîte de réception et envoie les emails d'alerte. En **local**, on le déclenche à la main pour tester. En **production** (Vercel), un **cron** l'appelle automatiquement (ex. 1×/jour).
- La **cloche et la boîte** lisent simplement la table de réception : elles fonctionnent en local dès qu'une collecte a rempli la boîte.

Les **emails réels ne partent qu'une fois le site déployé** avec un cron et une clé Resend. L'opt-in et toute la logique sont livrés maintenant ; l'envoi est best-effort (ignoré proprement si `RESEND_API_KEY` absent).

## 3. Modèle de données

Migration `0009_alertes.sql` :

```sql
-- Opt-in email par recherche.
alter table public.recherches add column if not exists alertes_email boolean not null default false;
-- Horodatage de la dernière collecte (throttling / info).
alter table public.recherches add column if not exists derniere_collecte timestamptz;

-- Boîte de réception des nouvelles offres, par utilisateur.
create table if not exists public.nouvelles_offres (
  user_id uuid not null references auth.users(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  recherche_id uuid references public.recherches(id) on delete set null,
  created_at timestamptz not null default now(),
  vue_le timestamptz,
  primary key (user_id, offre_id)
);
alter table public.nouvelles_offres enable row level security;
create policy nouvelles_offres_self on public.nouvelles_offres
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- **Nouvelle offre** = une offre nouvellement liée à une recherche de l'utilisateur (un `resultats` créé lors d'une re-collecte, absent avant). Insérée dans `nouvelles_offres` pour le propriétaire de la recherche, dédoublonnée par `(user_id, offre_id)` (une offre vue via plusieurs recherches n'apparaît qu'une fois).
- **Non vue** : `vue_le is null`. **Pastille** = nombre de `nouvelles_offres` non vues et **non expirées** (`created_at > now() - 24h`).
- **Boîte** : entrées `created_at > now() - 24h`, triées récentes d'abord.
- **Consulter une offre** (ouvrir sa page, ou cliquer dans la boîte) → pose `vue_le`. La pastille décroît.
- **Expiration 24 h** : les entrées de plus de 24 h ne sont plus comptées ni listées (nettoyage physique optionnel par le job).

## 4. Parcours et écrans

### 4.1 Cloche + boîte de réception

- **Cloche** à gauche de l'avatar de compte (haut à droite, sur toutes les pages). Pastille rouge avec le nombre de nouvelles offres non vues (masquée si 0).
- **Clic** → panneau déroulant « Nouvelles offres » listant les entrées non expirées (titre, employeur · ville, « il y a X h », pastille « nouveau » si non vue).
- **Clic sur une offre** → marque l'offre vue (`vue_le`) et navigue vers `/offre/[id]`. La pastille décroît.
- La cloche lit ses données côté client (RLS) et se met à jour après consultation.
- **Consultation directe** : ouvrir `/offre/[id]` marque aussi l'entrée correspondante vue (si présente), pour cohérence.
- État vide : « Aucune nouvelle offre ». Sous-texte discret : « Les nouvelles offres de tes recherches apparaîtront ici. »

### 4.2 Bouton « Alertes mail » (page résultats)

- Sur la page résultats (`/recherche/[id]`), un **petit bouton** activable dans la barre du haut : libellé court **« Alertes mail »** avec une icône cloche/enveloppe et un état on/off visible (couleur accent quand actif). Peu de texte.
- Au clic → bascule `recherches.alertes_email` pour cette recherche. Quand actif, les nouvelles offres de cette recherche seront envoyées par email (une fois le site déployé + cron).
- Un court tooltip/sous-texte au survol : « Recevoir les nouvelles offres par email ».

### 4.3 Rafraîchissement (endpoint)

- `POST /api/refresh` protégé par `COLLECT_SECRET` (comme `/api/collect`). Corps : `{ recherche_id }` (une recherche) ou `{ all: true }` (toutes). Pour chaque recherche : détecte les nouvelles offres, remplit `nouvelles_offres`, pose `derniere_collecte`, et si `alertes_email` envoie l'email. Renvoie un récap (`{ recherches, nouvelles, emails }`).
- **Local (test)** : l'utilisateur lance une commande `curl` fournie pour simuler l'arrivée de nouvelles offres.
- **Production** : `vercel.json` déclare un cron (ex. quotidien) qui appelle `/api/refresh` avec `{ all: true }`.

## 5. Logique et modules

### 5.1 Détection (`src/lib/alertes/detection.ts`)

- `offreIdsLies(client, rechercheId): Promise<Set<string>>` : ids d'offres déjà liés à la recherche.
- `rafraichirRecherche(client, recherche, deps?): Promise<{ nouvelles: string[] }>` : capture l'ensemble avant, lance `collectForRecherche`, recalcule l'ensemble après, renvoie les **nouveaux** `offre_id`. Pose `derniere_collecte`.
- `enregistrerNouvelles(client, userId, rechercheId, offreIds): Promise<number>` : insère les entrées `nouvelles_offres` (upsert `ignoreDuplicates` sur `(user_id, offre_id)`), renvoie le nombre inséré.

### 5.2 Boîte (`src/lib/alertes/boite.ts`)

- `type NouvelleOffre = { offre: OffreRow; created_at: string; vue_le: string | null }`
- `getBoite(client, userId): Promise<NouvelleOffre[]>` : entrées non expirées (< 24 h), jointes aux offres, triées récentes d'abord.
- `compterNonVues(client, userId): Promise<number>` : nombre non vues et non expirées.
- `marquerOffreVue(client, userId, offreId): Promise<void>` : pose `vue_le = now()` si l'entrée existe.

### 5.3 Email (`src/lib/alertes/email.ts`)

- `envoyerAlerte(params, deps?): Promise<boolean>` : envoie via l'API REST Resend (`POST https://api.resend.com/emails`, `Authorization: Bearer RESEND_API_KEY`, `fetch` injectable). Corps : `from` (adresse d'onboarding Resend en test, domaine vérifié en prod), `to` (email utilisateur), `subject`, `html` (liste des nouvelles offres avec liens). **Best-effort** : si `RESEND_API_KEY` absent, ne fait rien et renvoie `false` (aucune erreur bloquante).
- `buildEmailHtml(recherche, offres): string` (pur) : gabarit HTML sobre listant titre/employeur/ville + lien vers l'offre.

### 5.4 Server Actions / Endpoint

- `basculerAlertesEmail(rechercheId): Promise<{ actif: boolean }>` (Server Action, `src/lib/alertes/actions.ts`) : bascule `alertes_email` pour la recherche de l'utilisateur (RLS), renvoie l'état.
- `marquerVue(offreId): Promise<void>` (Server Action) : `marquerOffreVue` pour l'utilisateur courant.
- `POST /api/refresh` (`src/app/api/refresh/route.ts`) : orchestration décrite en 4.3 (service client, bypass RLS ; pour chaque recherche, détection + `enregistrerNouvelles` pour son `user_id` + email si opt-in). Protégé par `COLLECT_SECRET`.

### 5.5 Cron & déploiement

- `vercel.json` : `{ "crons": [{ "path": "/api/refresh?all=1", "schedule": "0 7 * * *" }] }` (ou l'endpoint lit `all` du corps ; adapter pour GET cron). Note : Vercel cron appelle en GET ; prévoir que `/api/refresh` accepte GET avec `?all=1` et l'en-tête d'autorisation cron, en plus du POST protégé par `COLLECT_SECRET`.
- Doc de déploiement (README ou note) : créer une clé Resend, ajouter `RESEND_API_KEY` (+ `ALERTE_FROM`, `ALERTE_CRON_SECRET`) aux variables d'environnement Vercel, vérifier le domaine d'envoi.

## 6. Composants (fichiers)

**Cloche/boîte** : `src/components/cloche-notifs.tsx` (client, pastille + panneau + consultation), monté dans `src/app/layout.tsx` à côté de `CompteMenu`.
**Toggle** : `src/components/alerte-mail-toggle.tsx` (client), intégré à la barre résultats (`src/components/filtres-bar.tsx` ou la barre de `/recherche/[id]`).
**Logique** : `src/lib/alertes/{detection,boite,email,actions}.ts`.
**Endpoint** : `src/app/api/refresh/route.ts`.
**Consultation** : `src/app/offre/[id]/page.tsx` appelle `marquerVue` (ou une action) au chargement pour marquer l'entrée vue.
**Données** : `supabase/migrations/0009_alertes.sql`. **Config** : `vercel.json`.
**Env** : `RESEND_API_KEY`, `ALERTE_FROM` (adresse expéditeur), à ajouter dans `.env.local` / Vercel.

## 7. Tests (Vitest)

- `rafraichirRecherche` (faux client + collect injecté) : renvoie les offre_id nouveaux (différence avant/après), pose `derniere_collecte`.
- `enregistrerNouvelles` : upsert `ignoreDuplicates` sur `(user_id, offre_id)`.
- `getBoite` / `compterNonVues` : n'incluent que les entrées < 24 h ; `compterNonVues` ne compte que `vue_le is null`.
- `marquerOffreVue` : pose `vue_le`.
- `buildEmailHtml` : contient le titre de la recherche et les offres.
- `envoyerAlerte` (fetch mocké) : bonne requête Resend ; sans clé → `false`, pas d'appel.
- `basculerAlertesEmail` (faux client) : bascule la valeur.
- Rendu `ClocheNotifs` : pastille = nombre non vues, masquée si 0 ; panneau liste les offres ; clic marque vue.
- Rendu `AlerteMailToggle` : reflète l'état actif/inactif ; clic appelle l'action.

## 8. Gestion des erreurs et cas limites

- **Aucune nouvelle offre** : boîte vide, pas de pastille, aucun email.
- **Re-collecte sans nouveauté** : `nouvelles = []`, rien inséré.
- **Offre déjà dans la boîte** (via une autre recherche) : `ignoreDuplicates` évite le doublon.
- **Expiration 24 h** : filtrage par `created_at` à la lecture (le nettoyage physique par le job est optionnel).
- **`RESEND_API_KEY` absent** : envoi ignoré proprement (best-effort), le reste du refresh fonctionne.
- **Échec d'une source de collecte** : déjà géré par `collectForRecherche` (Promise.allSettled).
- **Endpoint non autorisé** : 401 si le secret est absent/incorrect.
- **Consultation d'une offre sans entrée** : `marquerVue` ne fait rien (no-op).

## 9. Découpage en tâches (pour le plan)

1. Migration `0009_alertes` + `boite.ts` (`getBoite`, `compterNonVues`, `marquerOffreVue`) + type `NouvelleOffre`. Tests.
2. Détection : `offreIdsLies`, `rafraichirRecherche` (collect injecté), `enregistrerNouvelles`. Tests.
3. Endpoint `POST/GET /api/refresh` (protégé) orchestrant détection + `enregistrerNouvelles` (+ hook email). Tests d'orchestration. Commande curl locale.
4. Email Resend : `buildEmailHtml` + `envoyerAlerte` (best-effort) + branchement dans le refresh pour les recherches opt-in. Tests.
5. `ClocheNotifs` (pastille + boîte + consultation) monté dans le layout + `marquerVue` action + consultation sur `/offre/[id]`. Tests de rendu.
6. `AlerteMailToggle` sur la page résultats + `basculerAlertesEmail` action + `vercel.json` (cron) + note de déploiement (Resend + variables). Tests. Build.
