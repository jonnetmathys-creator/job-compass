import os
import sys
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
    for nom, scrape in SOURCES:
        try:
            lot = scrape(_fetch)
            print(f"[scraper] {nom} : {len(lot)} offres extraites")
            offres.extend(lot)
        except Exception as e:
            print(f"[scraper] {nom} en échec : {e}")

    with httpx.Client(timeout=20) as http:
        cache: dict[str, tuple[float, float] | None] = {}
        for o in offres:
            ville = o.get("ville")
            if not ville:
                continue
            if ville not in cache:
                cache[ville] = geocode_ville(ville, http)
            coords = cache[ville]
            if coords:
                o["latitude"], o["longitude"] = coords
        n = upsert_offres(offres, url, service_key, http)

    print(f"[scraper] {n} offres upsertées")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
