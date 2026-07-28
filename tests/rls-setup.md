# Tests RLS en local

Nécessite Docker Desktop lancé.

1. Démarrer Supabase local (applique les migrations de `supabase/migrations/`) :
   supabase start
2. Récupérer l'URL et les clés locales affichées (API URL, anon key, service_role key).
3. Exporter pour la session de test :
   export TEST_SUPABASE_URL=http://127.0.0.1:54321
   export TEST_SUPABASE_ANON_KEY=<anon key locale>
   export TEST_SUPABASE_SERVICE_ROLE_KEY=<service_role key locale>
4. Lancer : npm test -- rls
5. À la fin : supabase stop
