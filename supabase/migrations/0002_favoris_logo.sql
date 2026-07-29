-- Logo employeur (URL) fourni par la source, nullable
alter table public.offres add column if not exists entreprise_logo text;

-- Favoris : offres likées par un utilisateur
create table if not exists public.favoris (
  user_id uuid not null references auth.users(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, offre_id)
);

alter table public.favoris enable row level security;

-- Chacun ne voit et ne gère que ses favoris
create policy favoris_self on public.favoris
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
