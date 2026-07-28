-- Profils : 1 par utilisateur
create table public.profils (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nom text,
  titre_recherche text,
  cv_url text,
  lettre_base text,
  updated_at timestamptz not null default now()
);

-- Recherches enregistrées : N par utilisateur
create table public.recherches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intitule text not null,
  mots_cles text[] not null default '{}',
  code_metier text,               -- ex. J1402 (diététique)
  localisation text,              -- ville / code INSEE
  rayon_km int,
  type_contrat text,
  created_at timestamptz not null default now()
);

-- Offres : mutualisées entre tous, écrites par le service de collecte
create table public.offres (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null,
  titre text not null,
  entreprise text,
  description text,
  contrat text,
  salaire text,
  latitude double precision,
  longitude double precision,
  ville text,
  url_postuler text,
  email_contact text,
  date_publication timestamptz,
  date_collecte timestamptz not null default now(),
  unique (source, source_id)
);

-- Lien recherche <-> offre, avec score de pertinence
create table public.resultats (
  recherche_id uuid not null references public.recherches(id) on delete cascade,
  offre_id uuid not null references public.offres(id) on delete cascade,
  score_pertinence int,
  created_at timestamptz not null default now(),
  primary key (recherche_id, offre_id)
);

-- RLS
alter table public.profils   enable row level security;
alter table public.recherches enable row level security;
alter table public.offres    enable row level security;
alter table public.resultats enable row level security;

-- profils : chacun ne voit/modifie que le sien
create policy profils_self on public.profils
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- recherches : idem
create policy recherches_self on public.recherches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- offres : lecture par tout utilisateur authentifié, aucune écriture via anon (réservée au service_role, qui contourne la RLS)
create policy offres_read on public.offres
  for select using (auth.role() = 'authenticated');

-- resultats : visibles seulement si la recherche parente appartient à l'utilisateur
create policy resultats_self on public.resultats
  for select using (
    exists (select 1 from public.recherches r
            where r.id = resultats.recherche_id and r.user_id = auth.uid())
  );

-- Storage : bucket privé pour les CV
insert into storage.buckets (id, name, public) values ('cv', 'cv', false)
  on conflict (id) do nothing;

-- Un utilisateur ne gère que ses fichiers, rangés sous un préfixe = son user_id
create policy cv_self on storage.objects
  for all using (
    bucket_id = 'cv' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'cv' and (storage.foldername(name))[1] = auth.uid()::text
  );
