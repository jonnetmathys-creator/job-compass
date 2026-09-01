-- Coordonnées de l'expéditeur pour l'en-tête des lettres de motivation
-- (bloc haut-gauche : adresse, ville, téléphone, email). Tous optionnels.
alter table profils add column if not exists adresse text;
alter table profils add column if not exists code_postal text;
alter table profils add column if not exists ville text;
alter table profils add column if not exists telephone text;
alter table profils add column if not exists email text;
