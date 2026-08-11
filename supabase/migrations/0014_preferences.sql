-- Préférences de poste choisies par l'utilisateur (clés stables, voir src/lib/preferences.ts).
-- Alimentent le scoring IA (pondération douce). Défaut : aucune préférence.
alter table profils add column if not exists preferences text[] not null default '{}';
