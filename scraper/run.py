import os
import sys
from datetime import datetime, timezone
import httpx
from scrapling.fetchers import Fetcher
from scraper.sources.afdn import scrape_afdn
from scraper.sources.staffsante import scrape_staffsante
from scraper.geocode import geocode_ville
from scraper.supabase_rest import upsert_offres

# Chaque source est isolée : si l'une échoue, les autres remontent quand même leurs offres.
SOURCES = [("AFDN", scrape_afdn), ("StaffSanté", scrape_staffsante)]


def _fetch(url: str, headers: dict) -> str:
    # Scrapling Fetcher : empreinte navigateur, contourne les filtres d'en-têtes des sites.
    page = Fetcher.get(url, headers=headers)
    return page.html_content


def principal() -> int:
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    offres: list[dict] = []
    # Une source connue qui renvoie 0 (HTML changé, sélecteurs cassés) ne lève pas
    # d'exception : on le détecte pour faire échouer le run visiblement (sinon la
    # source disparaît en silence, puis la purge finit par la vider).
    en_echec: list[str] = []
    for nom, scrape in SOURCES:
        try:
            lot = scrape(_fetch)
            print(f"[scraper] {nom} : {len(lot)} offres extraites")
            if not lot:
                en_echec.append(f"{nom} (0 offre)")
            offres.extend(lot)
        except Exception as e:
            print(f"[scraper] {nom} en échec : {e}")
            en_echec.append(f"{nom} ({e})")

    # date_collecte = date de dernière vue : rafraîchie à chaque passage pour que
    # merge-duplicates la mette à jour (colonne absente = non mise à jour). Sans
    # cela, une offre toujours en ligne « vieillit » et sort des résultats/purge.
    maintenant = datetime.now(timezone.utc).isoformat()
    for o in offres:
        o["date_collecte"] = maintenant

    with httpx.Client(timeout=20) as http:
        cache: dict[str, tuple[float, float] | None] = {}
        for o in offres:
            ville = o.get("ville")
            coords = None
            if ville:
                if ville not in cache:
                    cache[ville] = geocode_ville(ville, http)
                coords = cache[ville]
            if coords:
                o["latitude"], o["longitude"] = coords
            else:
                # Pas de coords (ville absente ou géocodage KO) : on retire les clés
                # pour laisser merge-duplicates préserver celles déjà en base plutôt
                # que de les écraser à None.
                o.pop("latitude", None)
                o.pop("longitude", None)
        n = upsert_offres(offres, url, service_key, http)

    print(f"[scraper] {n} offres upsertées")
    if en_echec:
        print(f"[scraper] ÉCHEC : source(s) sans résultat : {', '.join(en_echec)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(principal())
