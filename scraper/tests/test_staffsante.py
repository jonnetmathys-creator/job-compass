from pathlib import Path
from scraper.sources.staffsante import parse_staffsante, _ville

FIXTURE = (Path(__file__).parent / "fixtures" / "staffsante.html").read_text(encoding="utf-8")


def test_parse_staffsante_extrait_les_offres():
    offres = parse_staffsante(FIXTURE)
    assert len(offres) >= 20
    o = offres[0]
    assert o["source"] == "staffsante"
    assert o["source_id"]
    assert o["titre"]
    assert "/offres-emploi-de-dieteticien/" in o["url_postuler"]
    assert o["url_postuler"].startswith("https://")


def test_parse_staffsante_deduplique_par_source_id():
    offres = parse_staffsante(FIXTURE)
    ids = [o["source_id"] for o in offres]
    assert len(ids) == len(set(ids))


def test_ville_isole_la_commune():
    assert _ville("Argenteuil (95) et Val-d'Oise") == "Argenteuil"
    assert _ville("Haute-Garonne et Toulouse (31)") == "Toulouse"
    assert _ville("Le Mans (72) et Sarthe") == "Le Mans"
