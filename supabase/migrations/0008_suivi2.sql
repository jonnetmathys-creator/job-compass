-- Mail de relance IA enregistré par candidature.
alter table public.candidatures add column if not exists relance_objet text;
alter table public.candidatures add column if not exists relance_corps text;

-- Candidatures manuelles : un utilisateur authentifié peut insérer et supprimer
-- une offre « manuelle » (saisie par lui, hors France Travail). Les offres
-- collectées restent gérées par le service role (bypass RLS).
create policy offres_insert_manuelle on public.offres
  for insert to authenticated
  with check (source = 'manuelle');

create policy offres_delete_manuelle on public.offres
  for delete to authenticated
  using (source = 'manuelle');
