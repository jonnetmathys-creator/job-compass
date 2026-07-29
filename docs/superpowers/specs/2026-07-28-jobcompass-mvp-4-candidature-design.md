# JobCompass · MVP Brique 4 : la Candidature assistée · Design

> Spec de conception. Brique 4 du MVP JobCompass. Prérequis : Briques 1, 2, 3 mergées sur `main`.

## 1. Objectif

Pour une offre donnée, générer un **email de candidature** et une **lettre de motivation** personnalisés, à partir du CV et de la lettre de base de l'utilisateur, via une IA gratuite (Google Gemini). L'utilisateur édite, puis copie l'email et télécharge la lettre en PDF pour postuler via le portail de l'offre ou l'email du contact.

C'est le cœur de valeur de JobCompass : transformer « voir des offres » en « candidater vite et bien ».

Hors périmètre : l'envoi réel de l'email depuis l'app (on postule via le portail / le contact). Le suivi des candidatures (statuts, réponses) est la brique suivante ; la table `candidatures` créée ici la prépare.

## 2. Décisions

- **Moteur** : Google Gemini, offre **gratuite** (clé Google AI Studio, sans carte). Modèle `gemini-2.0-flash` (rapide, multimodal, lit le PDF nativement). Clé validée et fonctionnelle.
- **Appel** : via l'API REST Gemini en `fetch` (pas de SDK, cohérent avec l'adaptateur France Travail), derrière une interface injectable et testable. Le CV PDF est envoyé en `inline_data` (base64), la réponse est demandée en **JSON structuré**.
- **Sécurité** : `GEMINI_API_KEY` reste **côté serveur** (Server Action), jamais exposée au navigateur.
- **Stockage** : chaque candidature (email + lettre + éditions) est enregistrée par offre → pas de régénération inutile, historique conservé, base du futur suivi.
- **Récupération** : copier l'email, copier la lettre, télécharger la lettre en **PDF via l'impression du navigateur** (sans lib).
- **Périmètre** : génération + édition + copie/téléchargement. Pas d'envoi.

## 3. Parcours et écrans

### 3.1 Déclencheur (page offre)

Sur `/offre/[id]`, le bouton placeholder « Candidater avec lettre IA · bientôt » devient **actif** et mène à `/offre/[id]/candidature`.

### 3.2 Écran Candidature (`/offre/[id]/candidature`)

- **En-tête** : rappel de l'offre (titre, employeur, ville) + bouton retour.
- **Profil incomplet** (pas de CV ou pas de `lettre_base`) : message « Complète ton profil (CV + lettre de base) avant de générer », avec lien vers `/profil`. Pas de bouton Générer.
- **Aucune candidature encore** : bouton **« Générer ma candidature »**. Au clic, état de chargement (« l'IA rédige ta candidature… »), puis affichage du résultat.
- **Candidature présente** (générée ou déjà enregistrée) :
  - **Email** : champ objet + zone de texte corps, éditables.
  - **Lettre de motivation** : zone de texte éditable.
  - Actions : **Enregistrer** (persiste les éditions), **Régénérer** (nouvel appel IA, remplace après confirmation), **Copier l'email**, **Copier la lettre**, **Télécharger la lettre en PDF**.
- Au retour ultérieur sur l'offre, la candidature enregistrée est **relue** (pas de régénération).

## 4. Le moteur Gemini

### 4.1 Server Action `genererCandidature(offreId)`

1. Vérifie la session (client serveur).
2. Charge le **profil** (`lettre_base`, `cv_url`, `nom`, `titre_recherche`) et l'**offre** (titre, entreprise, ville, contrat, description, url_postuler).
3. Refuse si `lettre_base` ou `cv_url` manquant (retourne une erreur explicite).
4. Télécharge le **CV PDF** depuis le stockage (`cv/{userId}/cv.pdf`) et le convertit en base64.
5. Construit le prompt et appelle l'API Gemini (`generateContent`) avec : instructions + infos offre + lettre de base + profil + **CV PDF en `inline_data`**, en demandant `response_mime_type: application/json` selon le schéma `{ email_objet, email_corps, lettre }`.
6. Parse et valide la réponse JSON.
7. **Upsert** dans `candidatures` (statut « brouillon »).
8. Retourne la candidature.

### 4.2 Modules

- `src/lib/candidature/gemini.ts` : `appelerGemini(params, deps?)` (fetch REST, clé via env, injection de `fetchImpl` pour les tests) ; `buildPrompt(offre, profil)` (pur) ; `parseReponse(json)` (pur, valide `{ email_objet, email_corps, lettre }`, lève une erreur claire si malformé).
- `src/lib/candidature/actions.ts` : Server Actions `genererCandidature(offreId)`, `enregistrerCandidature(offreId, patch)`.
- `src/lib/candidature/lecture.ts` : `getCandidature(client, userId, offreId)`.

### 4.3 Prompt (esprit)

Rôle : assistant de candidature en diététique. Consignes : email court et professionnel (objet + corps) ; lettre de motivation structurée, personnalisée à l'offre (employeur, missions) et au profil (CV joint + lettre de base), en français, ton sobre, sans invention de faits absents du CV. Sortie strictement au format JSON `{ email_objet, email_corps, lettre }`.

## 5. Modèle de données

Nouvelle table **`candidatures`** (migration `0005_candidatures.sql`) :
- `user_id uuid` (FK auth.users, cascade)
- `offre_id uuid` (FK offres, cascade)
- `email_objet text`, `email_corps text`, `lettre text`
- `statut text not null default 'brouillon'` (réservé au futur suivi)
- `created_at timestamptz default now()`, `updated_at timestamptz default now()`
- clé primaire `(user_id, offre_id)`
- RLS activée, policy `candidatures_self` : `auth.uid() = user_id` (using + with check).

## 6. Récupération (copie et PDF)

- **Copier** : boutons presse-papiers pour l'email (objet + corps) et pour la lettre.
- **Télécharger la lettre en PDF** : une vue imprimable propre de la lettre (mise en page sobre) + `window.print()` avec CSS `@media print` masquant le reste. L'utilisateur choisit « Enregistrer en PDF » dans la boîte d'impression. Aucune dépendance.

## 7. Gestion des erreurs et cas limites

- **Profil incomplet** (CV ou lettre de base manquant) : message + lien `/profil`, pas de génération.
- **Échec Gemini / quota atteint / JSON malformé** : message non bloquant (« La génération a échoué, réessaie. ») ; une candidature déjà enregistrée reste intacte et éditable.
- **CV illisible** (téléchargement échoué) : message explicite.
- **Offre inexistante ou d'un autre utilisateur** : 404.
- **Régénérer** : demande confirmation avant d'écraser une candidature existante.

## 8. Tests (Vitest)

- `buildPrompt` : contient le titre de l'offre, l'employeur, la lettre de base, le nom du profil.
- `parseReponse` : JSON valide → objet ; JSON malformé / champs manquants → erreur claire.
- `appelerGemini` avec `fetchImpl` mocké : construit la bonne requête (endpoint, clé, inline_data PDF, response schema) et renvoie le résultat parsé.
- `genererCandidature` avec faux client : profil complet → upsert appelé avec le résultat ; profil incomplet → erreur, pas d'appel.
- `getCandidature` : ne renvoie que la candidature de l'utilisateur.
- Rendu de l'éditeur : bouton « Générer » si aucune candidature ; champs éditables + boutons Copier si présente ; état « profil incomplet ».

## 9. Fichiers

**Écran** : `src/app/offre/[id]/candidature/page.tsx` (serveur), `src/components/candidature-editor.tsx` (client), `src/components/lettre-imprimable.tsx` (vue print).
**Logique** : `src/lib/candidature/{gemini,actions,lecture}.ts`.
**Données** : `supabase/migrations/0005_candidatures.sql`.
**Modif** : `src/components/offre-detail.tsx` (bouton actif → lien), `src/lib/env.ts` (le cas échéant), `src/proxy.ts` (déjà protégé via `/offre`).
**Dépendance** : aucune nouvelle (fetch natif). `GEMINI_API_KEY` déjà ajoutée à `.env.local`.

## 10. Découpage en tâches (pour le plan)

1. Migration `candidatures` + RLS + lecture `getCandidature` (+ tests).
2. Moteur Gemini : `buildPrompt` + `parseReponse` + `appelerGemini` (fetch REST, injection) (+ tests).
3. Server Actions `genererCandidature` + `enregistrerCandidature` (téléchargement CV, upsert, gardes profil) (+ tests avec faux client).
4. Écran candidature : page serveur + `CandidatureEditor` (générer, éditer, enregistrer, régénérer, copier) (+ tests de rendu).
5. Vue imprimable `LettreImprimable` + téléchargement PDF (impression) + activation du bouton sur la page offre.
