#!/usr/bin/env bash
# Compte les offres France Travail pour la diététique (code ROME J1402).
# Usage :
#   FT_ID="ton_client_id" FT_SECRET="ton_client_secret" ./scripts/ft-count.sh
#
# Aucun secret n'est stocké dans ce fichier : ils sont lus dans l'environnement.
set -euo pipefail

: "${FT_ID:?Définis FT_ID (client_id France Travail)}"
: "${FT_SECRET:?Définis FT_SECRET (client_secret France Travail)}"

CODE_ROME="J1402"   # Diététique
TOKEN_URL="https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire"
SEARCH_URL="https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search"

echo "→ Récupération du jeton d'accès…"
TOKEN=$(curl -s -X POST "$TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=$FT_ID" \
  --data-urlencode "client_secret=$FT_SECRET" \
  --data-urlencode "scope=api_offresdemploiv2 o2dsoffre" \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "${TOKEN:-}" ]; then
  echo "✗ Jeton non obtenu. Vérifie FT_ID / FT_SECRET et l'abonnement à l'API Offres d'emploi v2."
  exit 1
fi
echo "✓ Jeton OK"
echo

# Fonction : affiche le total renvoyé par l'API pour une requête donnée
count() {
  local label="$1"; shift
  local query="$1"
  # range=0-1 : on ne veut pas les offres, juste l'en-tête Content-Range: offres 0-1/TOTAL
  local total
  total=$(curl -s -D - -o /dev/null \
    -H "Authorization: Bearer $TOKEN" \
    "${SEARCH_URL}?codeROME=${CODE_ROME}&range=0-1&${query}" \
    | grep -i '^content-range:' | grep -o '/[0-9]*' | tr -d '/')
  printf "  %-32s %s offres\n" "$label" "${total:-0}"
}

echo "Offres de diététique (ROME $CODE_ROME) :"
count "Toute la France"            ""
count "Département 44 (Loire-Atl.)" "departement=44"
count "Autour de Nantes (30 km)"   "commune=44109&distance=30"
count "Autour de Nantes (100 km)"  "commune=44109&distance=100"
echo
echo "Astuce : change la commune (code INSEE) ou la distance pour tester ta zone."
