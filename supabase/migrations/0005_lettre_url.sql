-- Lettre de motivation de base, uploadée en PDF (chemin dans le bucket cv).
-- La colonne texte lettre_base existante est conservée (non supprimée) mais
-- n'est plus utilisée par l'UI ni la génération.
alter table public.profils add column if not exists lettre_url text;
