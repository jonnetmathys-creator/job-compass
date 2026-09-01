-- Index sur les colonnes de clé étrangère référençant offres.id et sur
-- offres.date_collecte. PostgreSQL indexe automatiquement les PK et contraintes
-- UNIQUE, mais jamais les colonnes FK : chaque DELETE sur offres (purge
-- quotidienne) doit alors vérifier la cascade par seq scan sur chaque table
-- enfant. Le filtre de purge (date_collecte < cutoff) faisait aussi un seq scan
-- de toute la table offres. Ces index rendent la purge O(log n) au lieu de O(n).

create index if not exists idx_resultats_offre_id on public.resultats (offre_id);
create index if not exists idx_favoris_offre_id on public.favoris (offre_id);
create index if not exists idx_candidatures_offre_id on public.candidatures (offre_id);
create index if not exists idx_rappels_offre_id on public.rappels (offre_id);
create index if not exists idx_nouvelles_offres_offre_id on public.nouvelles_offres (offre_id);
create index if not exists idx_scores_offre_id on public.scores (offre_id);
create index if not exists idx_offres_date_collecte on public.offres (date_collecte);
