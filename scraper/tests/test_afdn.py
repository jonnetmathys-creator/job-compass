from pathlib import Path
from scraper.sources.afdn import parse_afdn

FIXTURE = (Path(__file__).parent / "fixtures" / "afdn.html").read_text(encoding="utf-8")


def test_parse_afdn_extrait_les_offres():
    offres = parse_afdn(FIXTURE)
    assert len(offres) >= 2
    o = offres[0]
    assert o["source"] == "afdn"
    assert o["source_id"]                       # slug non vide
    assert o["titre"]                           # titre non vide
    assert o["url_postuler"].startswith("https://www.afdn.org/offre/")


def test_parse_afdn_extrait_la_ville_avec_code_postal():
    offres = parse_afdn(FIXTURE)
    avec_ville = [o for o in offres if o["ville"]]
    # Le champ node__adresse est présent sur toutes les offres AFDN.
    assert len(avec_ville) == len(offres)
    # Au moins une ville porte un code postal entre parenthèses.
    assert any(o["ville"] and "(" in o["ville"] for o in offres)


def test_parse_afdn_deduplique_par_source_id():
    offres = parse_afdn(FIXTURE)
    ids = [o["source_id"] for o in offres]
    assert len(ids) == len(set(ids))
