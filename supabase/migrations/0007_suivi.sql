-- Suivi des candidatures : notes libres, date de relance, date de candidature.
alter table public.candidatures add column if not exists notes text;
alter table public.candidatures add column if not exists relance_le date;
alter table public.candidatures add column if not exists postulee_le date;
