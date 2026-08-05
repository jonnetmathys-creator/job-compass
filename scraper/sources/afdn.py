import re
from scrapling.parser import Selector

BASE = "https://www.afdn.org"
URL = f"{BASE}/emploi?items_per_page=All"
ENTETES = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9",
}

# Adresse structurée AFDN : "VILLE 44400" -> "VILLE (44400)".
_ADRESSE = re.compile(r"^(.*?)\s*(\d{5})\s*$")


def _texte(selectors) -> str:
    return (selectors[0].text or "").strip() if selectors else ""


def _texte_complet(selectors) -> str:
    return selectors[0].get_all_text().strip() if selectors else ""


def _ville(adresse: str) -> str | None:
    txt = re.sub(r"\s+", " ", adresse or "").strip()
    if not txt:
        return None
    m = _ADRESSE.match(txt)
    if m:
        return f"{m.group(1).strip()} ({m.group(2)})"
    return txt


def parse_afdn(html: str) -> list[dict]:
    page = Selector(html)
    offres: dict[str, dict] = {}
    for art in page.css("article.node--type-offre"):
        about = art.attrib.get("about", "")
        if not about.startswith("/offre/"):
            continue
        source_id = about[len("/offre/"):]
        titre = _texte(art.css("span.field--name-title"))
        description = _texte_complet(art.css(".field--name-field-description .field__item"))
        adresse = _texte_complet(art.css(".node__adresse"))
        offres[source_id] = {
            "source": "afdn",
            "source_id": source_id,
            "titre": titre,
            "entreprise": None,
            "description": description or None,
            "contrat": None,
            "salaire": None,
            "latitude": None,   # rempli par le géocodage (clé toujours présente : upsert homogène)
            "longitude": None,
            "ville": _ville(adresse),
            "url_postuler": BASE + about,
            "email_contact": None,
            "date_publication": None,
        }
    return list(offres.values())


def scrape_afdn(fetch) -> list[dict]:
    """`fetch(url, headers) -> html (str)` ; injectable pour les tests."""
    html = fetch(URL, ENTETES)
    return parse_afdn(html)
