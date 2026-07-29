-- Candidature générée par offre (email + lettre + éditions).
create table if not exists public.candidatures (
  user_id uuid not null references auth.users(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  email_objet text,
  email_corps text,
  lettre text,
  statut text not null default 'brouillon',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, offre_id)
);

alter table public.candidatures enable row level security;

-- Chacun ne voit et ne gère que ses candidatures.
create policy candidatures_self on public.candidatures
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
