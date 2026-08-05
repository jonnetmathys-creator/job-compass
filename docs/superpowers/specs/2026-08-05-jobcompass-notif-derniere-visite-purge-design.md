# Notifications "depuis la dernière visite" + purge des vieilles offres · Design

**Goal :** faire en sorte que la cloche affiche toutes les offres nouvelles non encore vues depuis la dernière visite (au lieu des seules 24 dernières heures), et purger périodiquement les vieilles offres sans valeur pour libérer de l'espace.

**Architecture :** la collecte en arrière-plan existe déjà (cron `/api/refresh` qui remplit `nouvelles_offres` par utilisateur). On modifie seulement la lecture de la boîte (fenêtre + filtre non-vu) et on ajoute une étape de purge en fin de cron. Aucune nouvelle table.

**Tech Stack :** TypeScript, Next.js 16, Supabase (`@supabase/supabase-js`), Vitest.

## Global Constraints

- Jamais de tiret cadratin dans le code, les commentaires ou la doc. Utiliser `:` `,` ou `·`.
- Commentaires et messages en français.
- Le client service (`getServiceClient`) contourne la RLS : réservé au cron `/api/refresh`, jamais exposé au navigateur.
- Logique métier en fonctions pures testables ; les appels Supabase restent des enveloppes fines.
- Messages de commit terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Ne rien pousser sur GitHub : commits locaux uniquement.

## Contexte existant

- `nouvelles_offres` (migration 0009) : `user_id, offre_id, recherche_id, created_at, vue_le`, clé `(user_id, offre_id)`, remplie par le cron pour chaque utilisateur.
- `boite.ts` : `getBoite` et `compterNonVues` coupent à 24h via `cutoff24h()`. `getBoite` renvoie vu + non-vu ; `compterNonVues` ne compte que `vue_le IS NULL`.
- `offres` : possède `date_collecte` (posé à la collecte) et `created_by` (migration 0008, non nul pour les offres ajoutées à la main).
- Tables référençant `offres.id` en `on delete cascade` : `resultats`, `favoris`, `rappels`, `nouvelles_offres`, `candidatures`.

## Composant 1 · Cloche : non-vu sur 30 jours

Fichier : `src/lib/alertes/boite.ts`.

- Remplacer `cutoff24h()` par une constante et un helper :
  - `export const FENETRE_NOTIF_JOURS = 30`
  - `cutoffFenetre()` : `new Date(Date.now() - FENETRE_NOTIF_JOURS * 24*60*60*1000).toISOString()`
- `getBoite` : ajouter le filtre `vue_le IS NULL` et utiliser `cutoffFenetre()`. Chaîne de requête : `from('nouvelles_offres').select(...).eq('user_id', userId).is('vue_le', null).gt('created_at', cutoffFenetre())`. Le tri par `created_at` décroissant reste.
- `compterNonVues` : remplacer `cutoff24h()` par `cutoffFenetre()` (le filtre `is('vue_le', null)` existe déjà).

Comportement obtenu : la cloche liste les offres non encore consultées apparues dans les 30 derniers jours. Consulter une offre pose `vue_le` (déjà en place via `marquerOffreVue`) et la fait sortir de la cloche à la prochaine lecture. La fenêtre de 30 jours est alignée sur la rétention de la purge, donc aucune offre affichée ne peut avoir été purgée.

## Composant 2 · Purge des vieilles offres

Fichier créé : `src/lib/alertes/purge.ts`.

Rétention : `JOURS_RETENTION = 30`.

### Fonction pure `offresAPurger`

```
offresAPurger(input: {
  offres: { id: string; date_collecte: string | null; created_by: string | null }[]
  protegees: Set<string>   // ids référencés par favoris / candidatures / rappels
  cutoffISO: string        // maintenant - 30 jours
}): string[]               // ids à supprimer
```

Règle : renvoie l'`id` d'une offre si et seulement si `date_collecte` est non nul et `< cutoffISO`, `created_by` est nul, et `id` n'est pas dans `protegees`.

### Enveloppe `purgerVieillesOffres(client, jours = 30)`

1. Calculer `cutoffISO = maintenant - jours`.
2. Lire les offres candidates : `client.from('offres').select('id, date_collecte, created_by').lt('date_collecte', cutoffISO)`.
3. Lire les ids protégés en parallèle depuis `favoris`, `candidatures`, `rappels` (colonne `offre_id`), fusionnés dans un `Set`.
4. `ids = offresAPurger({ offres, protegees, cutoffISO })`.
5. Si `ids` non vide : `client.from('offres').delete().in('id', ids)`. Les lignes `resultats` et `nouvelles_offres` liées partent en cascade.
6. Retourner le nombre supprimé.

Les offres likées, en candidature, avec rappel, ou ajoutées à la main (`created_by` non nul) sont toujours conservées.

## Composant 3 · Branchement dans le cron

Fichier : `src/app/api/refresh/route.ts`.

Dans `traiter`, après la boucle de collecte, appeler la purge et l'ajouter au retour :

```
let purgees = 0
try { purgees = await purgerVieillesOffres(client) }
catch (e) { console.error('[refresh] purge en échec :', e) }
return { recherches: recherches.length, nouvelles, emails, purgees }
```

La purge s'exécute après la collecte : un échec de purge est loggé mais ne remet pas en cause la collecte déjà faite.

## Gestion d'erreurs

- Purge encapsulée dans un `try/catch` dans le cron : jamais bloquante.
- `getBoite` / `compterNonVues` : comportement inchangé en cas d'erreur Supabase (l'erreur remonte, la cloche reste silencieuse côté composant comme aujourd'hui).

## Tests

`src/lib/alertes/boite.test.ts` (mis à jour) :
- `getBoite` : la chaîne applique `is('vue_le', null)` et `gt('created_at', <30j>)` ; ne renvoie que le non-vu.
- `compterNonVues` : filtre `vue_le null` + fenêtre 30 jours.

`src/lib/alertes/purge.test.ts` (créé) :
- `offresAPurger` : supprime une offre vieille orpheline ; conserve une offre vieille protégée (dans `protegees`) ; conserve une offre vieille avec `created_by` non nul ; conserve une offre récente ; ignore une offre à `date_collecte` nul.
- `purgerVieillesOffres` : avec un client mocké, agrège les ids protégés des trois tables et appelle `delete().in('id', ids)` avec les seuls ids attendus ; retourne le compte.
