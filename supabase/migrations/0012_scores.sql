-- Cache du CV en texte (transcrit une fois depuis le PDF) pour le scoring.
alter table public.profils add column if not exists cv_texte text;

-- Score de pertinence CV <-> offre, par utilisateur.
create table if not exists public.scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  score int not null,
  raison text,
  cree_le timestamptz not null default now(),
  primary key (user_id, offre_id)
);
alter table public.scores enable row level security;
create policy scores_self on public.scores for select using (user_id = auth.uid());
