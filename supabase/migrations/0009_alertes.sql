-- Opt-in email par recherche + horodatage de collecte.
alter table public.recherches add column if not exists alertes_email boolean not null default false;
alter table public.recherches add column if not exists derniere_collecte timestamptz;

-- Boîte de réception des nouvelles offres, par utilisateur.
create table if not exists public.nouvelles_offres (
  user_id uuid not null references auth.users(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  recherche_id uuid references public.recherches(id) on delete set null,
  created_at timestamptz not null default now(),
  vue_le timestamptz,
  primary key (user_id, offre_id)
);
alter table public.nouvelles_offres enable row level security;
create policy nouvelles_offres_self on public.nouvelles_offres
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
