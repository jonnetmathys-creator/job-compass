# Rapprochement des doublons inter-sources

**Date :** 2026-08-11
**Objectif :** Regrouper un même poste publié sur plusieurs sources (France Travail, AFDN…) même quand le titre diffère ou que le lieu manque, en lisant aussi la description.

## Contexte

- `dedupeAffichage` (src/lib/offres/dedup-affichage.ts) regroupe déjà par empreinte exacte `titre|ville|entreprise` et remplit `plateformes` ; l'UI affiche « Aussi sur X » (offre-card). Le regroupement échoue dès que le titre diffère un peu.
- `empreinteOffre` reste utilisée par le scoring (execution.ts) : **inchangée**.
- Pas de migration DB. `email_contact` est déjà sélectionné (OFFRE_COLUMNS).

## Décisions (validées)

- Stratégie A (similarité titre + employeur/lieu) **+** C (description), niveau équilibré.
- UI inchangée : badge « Aussi sur X » + un seul bouton Postuler (source la plus complète).

## Algorithme

Regroupement glouton (première correspondance) sur les offres d'une recherche. Signatures pré-calculées par offre : employeur normalisé, ville normalisée, email (minuscule), titre, ensemble de shingles de description (groupes de 4 mots consécutifs, texte normalisé).

Prédicat `memePoste(a, b)` :
1. **Villes toutes deux renseignées et différentes → non** (contrainte dure ; le cas problématique est ville *absente*, non gênée par cette règle).
2. **Même email de contact non vide → oui** (signal fort).
3. **Recouvrement de description ≥ 0,6 → oui** : coefficient de recouvrement `|A∩B| / min(|A|,|B|)` sur les shingles (robuste aux troncatures), en exigeant ≥ 8 shingles de chaque côté (assez de contenu). Indépendant de l'employeur (les noms d'employeur varient entre sites) et du lieu.
4. Sinon, **rapprochement par titre** : uniquement si **le même employeur est renseigné des deux côtés**, alors `similariteTitre ≥ 0,6`.

`similariteTitre(a, b)` : tokens du titre normalisé (≥ 3 lettres), deux tokens « proches » s'ils sont égaux ou si l'un est préfixe de l'autre (≥ 5 lettres, ex. diététicien≈diététicienne). Score symétrique `(matchsA + matchsB) / (|A| + |B|)`.

Représentant du groupe = offre la plus complète (coords > description > date, `plusComplete` inchangé). `plateformes` = source du représentant puis autres sources, dédupliquées.

Seuils tunables (0,6 / 0,6) : les vrais repostages dépassent largement 0,6 en description ; deux rôles distincts partageant du boilerplate restent en dessous.

## Ce que ça préserve (tests existants)

- Fusion de sources identiques, normalisation H/F, villes différentes non fusionnées, représentant avec coordonnées, entreprise nulle ≠ entreprise renseignée, ordre d'entrée.

## Tests ajoutés

- `similariteTitre` : identiques = 1 ; « Diététicien »/« Diététicien nutritionniste » ≥ 0,6 ; « Diététicien »/« Diététicien coordinateur de service » < 0,6.
- Fusion titres différents, même employeur + ville.
- Fusion par description identique quand ville et titre diffèrent (lieu absent).
- Non-fusion de deux rôles distincts (titre éloigné, descriptions différentes) au même employeur.
- Fusion par email identique malgré titres différents.
- Non-fusion de deux offres sans employeur ni ville, titres et descriptions différents.

## Hors périmètre

- Scoring (dedup exact) inchangé. UI inchangée. Pas de lien Postuler par plateforme. Pas de migration.
