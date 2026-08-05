from scraper.supabase_rest import upsert_offres


class FakeResp:
    status_code = 201

    def raise_for_status(self):
        pass


class FakeHttp:
    def __init__(self):
        self.calls = []

    def post(self, url, headers=None, json=None):
        self.calls.append({"url": url, "headers": headers, "json": json})
        return FakeResp()


def test_upsert_offres_construit_la_requete():
    http = FakeHttp()
    rows = [{"source": "afdn", "source_id": "x", "titre": "T"}]
    n = upsert_offres(rows, "https://proj.supabase.co", "SERVICE_KEY", http)
    assert n == 1
    call = http.calls[0]
    assert call["url"] == "https://proj.supabase.co/rest/v1/offres?on_conflict=source,source_id"
    assert call["headers"]["Authorization"] == "Bearer SERVICE_KEY"
    assert call["headers"]["apikey"] == "SERVICE_KEY"
    assert call["headers"]["Prefer"] == "resolution=merge-duplicates"
    assert call["json"] == rows


def test_upsert_offres_vide_ne_fait_rien():
    http = FakeHttp()
    n = upsert_offres([], "https://proj.supabase.co", "SERVICE_KEY", http)
    assert n == 0
    assert http.calls == []
