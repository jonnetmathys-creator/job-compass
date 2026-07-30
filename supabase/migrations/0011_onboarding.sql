-- Flag de première connexion : la visite guidée ne se déclenche que tant qu'il est faux.
alter table public.profils add column if not exists onboarding_termine boolean not null default false;
