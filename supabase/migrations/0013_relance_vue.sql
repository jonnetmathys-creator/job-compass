-- Relances du suivi : horodatage de la dernière fois où l'utilisateur a « vu »
-- la relance à faire (clic dans la cloche) OU a été notifié par email.
-- null = jamais vue/notifiée -> apparaît en rouge dans la cloche et déclenche
-- l'unique email de relance. Une fois posée, la relance se grise puis
-- réapparaît une semaine plus tard si la candidature est toujours « postulee ».
alter table public.candidatures add column if not exists relance_vue_le timestamptz;
