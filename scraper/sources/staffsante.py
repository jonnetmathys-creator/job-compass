import re
from scrapling.parser import Selector

BASE = "https://www.staffsante.fr"
URL = f"{BASE}/recherche?par_page=100&quoi=Di%C3%A9t%C3%A9ticien&site=1&trie_par=date_published"
ENTETES = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9",
}


def _norm(s: str | None) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def _ville(lieu: str) -> str | None:
    # "Argenteuil (95) et Val-d'Oise" -> "Argenteuil" ; "Haute-Garonne et Toulouse (31)" -> "Toulouse".
    avant = _norm(lieu).split("(")[0].strip()
    ville = avant.split(" et ")[-1].strip()
    return ville or None


def parse_staffsante(html: str) -> list[dict]:
    page = Selector(html)
    offres: dict[str, dict] = {}
    for art in page.css("article.offer__article"):
        lien = art.css(".header-favorite-item a")
        if not lien:
            continue
        href = lien[0].attrib.get("href", "")
        if "/offres-emploi-de-dieteticien/" not in href:
            continue
        bouton = art.css("[data-job-id]")
        source_id = bouton[0].attrib.get("data-job-id") if bouton else href.rstrip("/").split("/")[-1]
        soc = art.css("small a")
        tags = art.css("ul.offer__article__tag li")
        contrat = _norm(tags[0].text) if tags else None
        lieu = _norm(tags[-1].get_all_text()) if tags else ""
        desc = art.css(".show-for-medium p")
        offres[source_id] = {
            "source": "staffsante",
            "source_id": source_id,
            "titre": _norm(lien[0].text),
            "entreprise": _norm(soc[0].text) if soc else None,
            "description": _norm(desc[0].get_all_text()) if desc else None,
            "contrat": contrat,
            "salaire": None,
            "latitude": None,
            "longitude": None,
            "ville": _ville(lieu),
            "url_postuler": href if href.startswith("http") else BASE + href,
            "email_contact": None,
            "date_publication": None,
        }
    return list(offres.values())


def scrape_staffsante(fetch) -> list[dict]:
    """`fetch(url, headers) -> html (str)` ; injectable pour les tests."""
    html = fetch(URL, ENTETES)
    return parse_staffsante(html)
