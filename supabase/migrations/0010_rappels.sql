-- Rappels « Pas encore » : l'utilisateur a consulté une offre mais n'a pas encore
-- postulé. Une seule ligne par (utilisateur, offre) : un nouveau « Pas encore »
-- réinitialise la ligne (l'ancien rappel disparaît au profit du nouveau).
create table if not exists public.rappels (
  user_id uuid not null references auth.users(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  consulte_le timestamptz not null default now(), -- dernier « Pas encore » (base du « il y a X »)
  relance_le timestamptz not null,                -- première échéance du rappel (consulte_le + 2 j)
  vue_le timestamptz,                             -- dernière consultation du rappel (null = non-vu / rouge)
  statut text not null default 'en_attente',      -- en_attente | postulee
  dispo boolean not null default true,            -- offre encore disponible à la dernière vérif
  verifie_le timestamptz,                         -- dernière vérif de disponibilité
  primary key (user_id, offre_id)
);
alter table public.rappels enable row level security;
create policy rappels_self on public.rappels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
