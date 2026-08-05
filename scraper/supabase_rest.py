def upsert_offres(rows: list[dict], url: str, service_key: str, http) -> int:
    """Upsert des offres dans la table `offres` via PostgREST (conflit sur source,source_id)."""
    if not rows:
        return 0
    endpoint = f"{url}/rest/v1/offres?on_conflict=source,source_id"
    entetes = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    resp = http.post(endpoint, headers=entetes, json=rows)
    resp.raise_for_status()
    return len(rows)
