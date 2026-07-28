# JobCompass · Design du MVP

Date : 2026-07-28
Statut : validé en brainstorming, prêt pour le plan d'implémentation

## 1. Vision

Application web qui centralise la recherche d'emploi et l'aide à la candidature. Elle collecte automatiquement des offres depuis des sources officielles, les présente en liste et sur une carte, note leur pertinence par IA, et (dans les briques suivantes) génère des lettres de motivation adaptées et suit l'avancement des candidatures.

Le MVP se concentre sur les **métiers de la diététique**, tout en gardant une architecture ouverte à d'autres métiers.

## 2. Cadre validé

| Sujet | Décision |
|---|---|
| Public | L'auteur + quelques proches. Comptes séparés, pas d'inscription publique. |
| Sourcing | API officielles / agrégateurs. Pas de scraping direct de sites hostiles. |
| Métier (MVP) | Diététique uniquement (code ROME J1402), architecture ouverte à d'autres métiers. |
| Lettre de motivation | Brouillon généré par IA adapté à l'offre, relu et modifié par l'utilisateur avant envoi (brique ultérieure). |
| Recherche | Filtres classiques (zone, rayon, contrat, mots-clés) + tri IA par pertinence. |
| Forme | Application web hébergée, responsive ordi + mobile. |
| Direction visuelle | Montserrat multi-graisses, arrondis façon Airbnb, accent vert (#2e9e5b), ombres douces, animations fluides. |

## 3. Périmètre du MVP (tranche verticale)

Le MVP est une tranche verticale utilisable de bout en bout :

1. **Comptes et profil** : login, profil, upload du CV (PDF), lettre de motivation de base (texte).
2. **Collecteur multi-sources** : France Travail + Adzuna, dédoublonnage, stockage.
3. **Recherche et tri** : filtres, tri IA par pertinence.
4. **Affichage** : liste + carte (split repliable façon Airbnb).

**Hors périmètre du MVP** (briques suivantes, voir section 10) :
- Génération de lettre de motivation par IA
- Suivi des candidatures (postulé / réponse +/-)
- Marché caché via La Bonne Boîte (candidatures spontanées)
- Sources supplémentaires (Jooble, flux RSS)
- Passe de polish visuel (icônes personnalisées, raffinement de la DA)

## 4. Stack technique

- **Next.js** (front + routes API dans un seul projet), déployé sur **Vercel**.
- **Supabase** : base Postgres, authentification, stockage des CV, sécurité au niveau des lignes (RLS).
- **Leaflet + OpenStreetMap** pour la carte (gratuit, sans clé API).
- **API Claude** (modèle Haiku, économique) pour le tri de pertinence, et plus tard la génération de lettres.
- **Cron Vercel** pour déclencher le collecteur en tâche de fond.

Coût à l'échelle du projet : quasi nul, hors appels IA facturés à l'usage (faibles).

## 5. Architecture et flux de données

Principe directeur : **la collecte est découplée de la consultation**. L'utilisateur ne dépend jamais d'une API externe pendant qu'il navigue.

**Flux A · Collecte (tâche de fond)**
Un cron (ex. toutes les 6 h) parcourt les recherches enregistrées, interroge chaque source (France Travail, Adzuna), dédoublonne, enregistre les offres, puis score les nouvelles offres par IA.

**Flux B · Consultation (temps réel)**
L'utilisateur ouvre une recherche : l'app lit les offres déjà en base, les affiche en liste et sur la carte, triées par pertinence.

**Flux C · Profil**
L'utilisateur gère son profil, son CV (PDF sur Supabase Storage) et sa lettre de base.

```
   Cron (6h) ──▶ Collecteur ──▶ [France Travail | Adzuna] ──┐ écrit
                                                            ▼
   Utilisateur ──▶ Next.js (web) ◀──── lit ──── Supabase (offres, recherches, profils, résultats)
```

## 6. Modèle de données

- **users** (Supabase Auth) : email, mot de passe.
- **profils** (1 par utilisateur) : `user_id`, `nom`, `titre_recherché`, `cv_url`, `lettre_base`.
- **recherches** (N par utilisateur) : `user_id`, `intitulé`, `mots_clés`, `code_métier` (ROME, préréglé J1402 au MVP), `localisation`, `rayon_km`, `type_contrat`, `date_création`.
- **offres** (mutualisées entre tous) : `source`, `source_id`, `titre`, `entreprise`, `description`, `contrat`, `salaire`, `latitude`, `longitude`, `ville`, `url_postuler`, `date_publication`, `date_collecte`.
- **resultats** (lien recherche ↔ offre) : `recherche_id`, `offre_id`, `score_pertinence`, `date`.

Décisions de conception :
- Les offres sont **mutualisées** et reliées aux recherches via `resultats`, pour éviter la duplication et préparer le multi-utilisateurs.
- Le dédoublonnage se fait sur le couple (`source`, `source_id`).
- La table **candidatures** (`user_id`, `offre_id`, `statut`) n'existe pas au MVP mais s'ajoutera sans refonte (brique Suivi).

## 7. Le collecteur (pièce maîtresse)

Vit entièrement côté serveur.

- **Authentification** : OAuth2 pour France Travail (inscription sur francetravail.io, `client_id` + `client_secret` en variables d'environnement Vercel), clé API pour Adzuna. Jeton France Travail mis en cache et renouvelé à expiration.
- **Traduction recherche → requête** : chaque recherche est convertie en appels API avec mots-clés, code métier (J1402 injecté automatiquement au MVP), commune + rayon, type de contrat. Pagination jusqu'à un plafond (ex. 300 offres par recherche et par source) pour respecter les limites de débit.
- **Multi-sources** : chaque source normalise ses résultats vers le schéma commun `offres`. Ajouter une source = ajouter un adaptateur, sans toucher au reste.
- **Dédoublonnage** : si (`source`, `source_id`) existe, on met à jour `date_collecte` ; sinon on insère. Puis on crée/rafraîchit la ligne `resultats`. Les offres identiques trouvées sur plusieurs sources sont fusionnées.
- **Tri IA** : pour chaque **nouvelle** offre, l'API Claude (Haiku) note la pertinence de 0 à 100 vs l'intitulé de la recherche et le titre recherché du profil. Score stocké dans `resultats`. On ne re-score jamais une offre déjà notée (maîtrise du coût).
- **Idempotence** : le collecteur peut être relancé sans créer de doublon ni re-facturer un score.

## 8. Interface utilisateur

**Écran principal** : split façon Airbnb.
- Volet gauche : liste des offres (cartes), **repliable** pour laisser la carte en plein écran.
- Volet droit : carte Leaflet, épingles en pastille affichant une info clé (salaire, contrat, ville).
- Responsive : bascule en onglets Liste / Carte sur mobile.

**Carte d'offre** : titre · badge **% de pertinence** (vert = fort match, orange = moyen) · employeur + ville · étiquettes (contrat, temps, salaire, date de publication).

**Direction visuelle** : Montserrat en plusieurs graisses (logo bold, titres semi-bold, méta regular, dates italic), arrondis généreux, ombres douces, accent vert #2e9e5b. Animations : apparition en fondu des cartes, glissement du volet au repli, survol qui surélève la carte et met en évidence l'épingle correspondante.

**Autres écrans MVP** : connexion, profil (infos + upload CV + lettre de base), création/édition d'une recherche.

## 9. Comptes, erreurs, tests

**Comptes et multi-utilisateurs**
Login email + mot de passe (Supabase Auth). Pas d'inscription publique : comptes créés manuellement ou par invitation. RLS activée : un utilisateur ne peut jamais lire les recherches, résultats ou (plus tard) candidatures d'un autre. Les offres restent mutualisées et lisibles par tous.

**Gestion des erreurs**
- Source indisponible / quota atteint : log, on passe à la recherche ou source suivante, réessai au prochain cron. Les offres déjà en base restent consultables.
- Échec du tri IA : l'offre est stockée sans score, affichée en bas de liste, et le tri est réessayé au prochain passage du cron. Jamais de plantage.
- Aucune offre trouvée : écran vide soigné suggérant d'élargir le rayon ou d'assouplir les critères.

Principe : l'app reste utilisable même quand une brique externe tombe.

**Tests (approche TDD sur la logique métier)**
- Traduction recherche → requête API (bons paramètres, code diététique injecté).
- Normalisation multi-sources vers le schéma commun.
- Dédoublonnage (aucune duplication, y compris entre sources).
- Idempotence du collecteur (3 relances = même état).
- Isolation entre utilisateurs (RLS : A ne voit pas les données de B).

## 10. Suite (briques post-MVP)

Dans l'ordre pressenti, chacune avec sa propre spec :

1. **Marché caché** : intégration de La Bonne Boîte (entreprises susceptibles d'embaucher sur le code diététique dans une zone), pour proposer des candidatures spontanées. Ajoute un type de donnée « entreprise » et la notion de candidature spontanée.
2. **Candidature assistée** : génération de lettre de motivation adaptée à l'offre par IA, relue et modifiée, puis export.
3. **Suivi des candidatures** : statuts (postulé, réponse +/-, relance), table `candidatures`.
4. **Sources supplémentaires** : Jooble, flux RSS.
5. **Ouverture à d'autres métiers** : sélection du code ROME au lieu du préréglage diététique.
6. **Passe de polish visuel** : icônes personnalisées, raffinement de la direction artistique.
