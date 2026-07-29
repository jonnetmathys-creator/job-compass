-- Mail de relance IA enregistré par candidature.
alter table public.candidatures add column if not exists relance_objet text;
alter table public.candidatures add column if not exists relance_corps text;

-- Candidatures manuelles : un utilisateur authentifié peut insérer et supprimer
-- une offre « manuelle » (saisie par lui, hors France Travail). Les offres
-- collectées restent gérées par le service role (bypass RLS).
-- Colonne de propriété : seule une vraie colonne « created_by » garantit que
-- la propriété d'une offre manuelle n'est pas dérivée (et donc falsifiable)
-- via la présence d'une candidature.
alter table public.offres add column if not exists created_by uuid references auth.users(id) on delete set null;

create policy offres_insert_manuelle on public.offres
  for insert to authenticated
  with check (source = 'manuelle' and created_by = auth.uid());

create policy offres_delete_manuelle on public.offres
  for delete to authenticated
  using (source = 'manuelle' and created_by = auth.uid());

-- Lecture des offres manuelles restreinte à leur créateur : les offres France
-- Travail restent lisibles par tout utilisateur authentifié, mais une offre
-- manuelle ne doit pas être énumérable par un autre utilisateur que son auteur.
drop policy if exists offres_read on public.offres;
create policy offres_read on public.offres
  for select to authenticated
  using (source <> 'manuelle' or created_by = auth.uid());
