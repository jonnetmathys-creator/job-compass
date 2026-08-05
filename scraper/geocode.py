import re

BASE = "https://api-adresse.data.gouv.fr/search/"


def geocode_ville(ville: str, http) -> tuple[float, float] | None:
    """Géocode une ville. Utilise le code postal s'il est présent (plus fiable)."""
    if not ville:
        return None
    m = re.search(r"\d{5}", ville)
    requete = m.group(0) if m else ville
    resp = http.get(BASE, params={"q": requete, "type": "municipality", "limit": 1})
    if resp.status_code != 200:
        return None
    feats = resp.json().get("features") or []
    if not feats:
        return None
    lng, lat = feats[0]["geometry"]["coordinates"]
    return (lat, lng)
