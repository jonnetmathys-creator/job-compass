# JobCompass MVP · Plan 1 · Fondations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place le socle de l'application : projet Next.js, connexion Supabase, schéma de base complet avec sécurité par ligne (RLS), authentification sans inscription publique, et gestion du profil (infos + CV PDF + lettre de motivation de base).

**Architecture:** Application Next.js (App Router, TypeScript) déployable sur Vercel, adossée à Supabase (Postgres + Auth + Storage). Les accès aux données passent par une fine couche de fonctions typées testées unitairement ; l'isolation entre utilisateurs est garantie par des politiques RLS testées en intégration contre un Supabase local. À la fin de ce plan, un utilisateur créé manuellement peut se connecter et gérer son profil.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Vitest + @testing-library/react, police Montserrat via `next/font/google`.

## Global Constraints

- **Public** : pas d'inscription publique. Les comptes sont créés manuellement (script de seed / dashboard Supabase). Aucune page `/signup` exposée.
- **Isolation** : un utilisateur ne peut jamais lire ou modifier les `profils`, `recherches`, `resultats` d'un autre. RLS activée sur toutes les tables portant un `user_id`.
- **Offres mutualisées** : la table `offres` est lisible par tous les utilisateurs authentifiés, écrite uniquement par le service de collecte (rôle service). Pas de `user_id` dessus.
- **Direction visuelle** : police **Montserrat** (graisses 300/400/500/600/700), arrondis généreux, accent vert **#2e9e5b**, ombres douces.
- **Métier (MVP)** : diététique, code ROME **J1402** (utilisé au plan 2 ; le champ `code_metier` existe dès ce plan).
- **Langue de l'interface** : français.
- **Secrets** : jamais en dur dans le code ni committés. Variables d'environnement dans `.env.local` (déjà gitignoré).
- **Commits fréquents** : un commit par étape verte (test qui passe).

---

## Prérequis externes (à faire une fois avant la Task 1)

Ces étapes ne sont pas des tâches de code mais conditionnent le plan.

1. **Créer un projet Supabase** sur https://supabase.com (gratuit). Noter, dans *Project Settings → API* :
   - `Project URL` → variable `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → variable `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` (secret) → variable `SUPABASE_SERVICE_ROLE_KEY`
2. **Installer la CLI Supabase** (pour les migrations et les tests RLS en local) :
   ```bash
   npm install -g supabase
   ```
   Les tests RLS de la Task 3 utilisent un Supabase local via **Docker Desktop** (à installer si absent : https://www.docker.com/products/docker-desktop). Docker est requis uniquement pour lancer les tests d'intégration, pas pour développer l'app.

À la fin de la Task 1, le fichier `.env.local` devra contenir (en plus de `FT_ID` / `FT_SECRET` déjà présents) :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
```

---

## File Structure

- `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts` — configuration projet.
- `src/app/layout.tsx` — layout racine, police Montserrat, styles globaux.
- `src/app/globals.css` — Tailwind + variables de thème (accent vert).
- `src/app/page.tsx` — page d'accueil (redirige vers /offres ou /login selon session).
- `src/app/login/page.tsx` — page de connexion (email + mot de passe).
- `src/app/profil/page.tsx` — page profil (formulaire + upload CV).
- `src/lib/supabase/client.ts` — client Supabase navigateur.
- `src/lib/supabase/server.ts` — client Supabase serveur (lecture cookies).
- `src/lib/supabase/service.ts` — client Supabase rôle service (collecte, plan 2).
- `src/lib/profil.ts` — couche d'accès aux données profil (get/upsert/upload CV).
- `src/middleware.ts` — protège les routes authentifiées, redirige vers /login.
- `supabase/migrations/0001_schema.sql` — schéma complet (5 tables) + RLS.
- `supabase/seed-user.mjs` — script de création d'un utilisateur (pas d'inscription publique).
- `src/lib/profil.test.ts`, `src/app/login/login.test.tsx` — tests.
- `tests/rls.test.ts` — test d'intégration RLS contre Supabase local.

---

## Task 1: Scaffold Next.js + Tailwind + Vitest + Montserrat

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `vitest.setup.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Test: `src/app/smoke.test.tsx`

**Interfaces:**
- Produces: un projet Next.js qui démarre (`npm run dev`) et un runner de test (`npm test`) fonctionnel. La police Montserrat et la variable CSS `--accent` (#2e9e5b) sont disponibles globalement.

- [ ] **Step 1: Créer le projet Next.js**

Run :
```bash
cd /Users/mathys.jnt/job-compass
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm --yes
```
(Si create-next-app refuse à cause de fichiers existants, il conserve `.env.local`, `docs/`, `scripts/` ; garder ces dossiers.)

- [ ] **Step 2: Installer les dépendances de test**

Run :
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configurer Vitest**

Create `vitest.config.ts` :
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

Create `vitest.setup.ts` :
```ts
import '@testing-library/jest-dom/vitest'
```

Add to `package.json` scripts :
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Écrire un test smoke qui échoue**

Create `src/app/smoke.test.tsx` :
```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Home from './page'

test('la page d’accueil affiche le nom du produit', () => {
  render(<Home />)
  expect(screen.getByText(/JobCompass/i)).toBeInTheDocument()
})
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il échoue**

Run : `npm test -- smoke`
Expected : FAIL (la page par défaut de create-next-app ne contient pas "JobCompass").

- [ ] **Step 6: Définir le thème global et la police Montserrat**

Replace `src/app/layout.tsx` :
```tsx
import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'JobCompass',
  description: 'Centralisez et envoyez vos candidatures en diététique.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  )
}
```

Add to the top-level of `src/app/globals.css` (after the Tailwind import) :
```css
:root {
  --accent: #2e9e5b;
  --accent-soft: #e7f5ec;
  --ink: #1c1e21;
}
body { font-family: var(--font-montserrat), system-ui, sans-serif; color: var(--ink); }
```

- [ ] **Step 7: Écrire la page d'accueil minimale**

Replace `src/app/page.tsx` :
```tsx
export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center">
      <h1 className="text-2xl font-bold tracking-tight">
        Job<span style={{ color: 'var(--accent)' }}>Compass</span>
      </h1>
    </main>
  )
}
```

- [ ] **Step 8: Lancer le test pour vérifier qu'il passe**

Run : `npm test -- smoke`
Expected : PASS

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Tailwind + Vitest + thème Montserrat"
```

---

## Task 2: Clients Supabase (navigateur, serveur, service)

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/service.ts`
- Create: `src/lib/env.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Produces :
  - `getBrowserClient(): SupabaseClient` — client côté navigateur (composants clients).
  - `getServerClient(): Promise<SupabaseClient>` — client côté serveur, lit la session via cookies.
  - `getServiceClient(): SupabaseClient` — client rôle service (bypass RLS), usage serveur uniquement (plan 2).
  - `requireEnv(name): string` — lève une erreur claire si une variable d'env manque.

- [ ] **Step 1: Installer les libs Supabase**

Run :
```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Écrire le test de `requireEnv` (échoue)**

Create `src/lib/env.test.ts` :
```ts
import { expect, test, afterEach } from 'vitest'
import { requireEnv } from './env'

afterEach(() => { delete process.env.TEST_VAR })

test('requireEnv renvoie la valeur quand elle existe', () => {
  process.env.TEST_VAR = 'ok'
  expect(requireEnv('TEST_VAR')).toBe('ok')
})

test('requireEnv lève une erreur explicite quand absente', () => {
  expect(() => requireEnv('TEST_VAR')).toThrow(/TEST_VAR/)
})
```

- [ ] **Step 3: Vérifier l'échec**

Run : `npm test -- env`
Expected : FAIL (module `./env` introuvable).

- [ ] **Step 4: Implémenter `env.ts`**

Create `src/lib/env.ts` :
```ts
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`)
  return value
}
```

- [ ] **Step 5: Vérifier que le test passe**

Run : `npm test -- env`
Expected : PASS

- [ ] **Step 6: Implémenter les trois clients Supabase**

Create `src/lib/supabase/client.ts` :
```ts
import { createBrowserClient } from '@supabase/ssr'
import { requireEnv } from '@/lib/env'

export function getBrowserClient() {
  return createBrowserClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
}
```

Create `src/lib/supabase/server.ts` :
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireEnv } from '@/lib/env'

export async function getServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* appelé depuis un Server Component : ignoré */ }
        },
      },
    },
  )
}
```

Create `src/lib/supabase/service.ts` :
```ts
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/env'

// Rôle service : contourne la RLS. À n'utiliser QUE côté serveur (collecte, plan 2).
export function getServiceClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: clients Supabase (navigateur/serveur/service) + garde-fou env"
```

---

## Task 3: Schéma de base + politiques RLS

**Files:**
- Create: `supabase/migrations/0001_schema.sql`
- Test: `tests/rls.test.ts`
- Create: `tests/rls-setup.md` (procédure de lancement)

**Interfaces:**
- Produces : les tables `profils`, `recherches`, `offres`, `resultats` (+ le bucket Storage `cv`), avec RLS garantissant l'isolation par `user_id`. Colonnes utilisées par les plans suivants : voir le SQL ci-dessous (source de vérité des noms de colonnes).

- [ ] **Step 1: Écrire la migration SQL**

Create `supabase/migrations/0001_schema.sql` :
```sql
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
```

- [ ] **Step 2: Documenter le lancement des tests RLS**

Create `tests/rls-setup.md` :
```markdown
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
```

- [ ] **Step 3: Écrire le test d'intégration RLS (échoue)**

Create `tests/rls.test.ts` :
```ts
import { createClient } from '@supabase/supabase-js'
import { beforeAll, expect, test } from 'vitest'

const url = process.env.TEST_SUPABASE_URL!
const anon = process.env.TEST_SUPABASE_ANON_KEY!
const service = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, service, { auth: { persistSession: false } })

async function makeUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: 'motdepasse123', email_confirm: true,
  })
  if (error) throw error
  const client = createClient(url, anon, { auth: { persistSession: false } })
  await client.auth.signInWithPassword({ email, password: 'motdepasse123' })
  return { id: data.user!.id, client }
}

let alice: Awaited<ReturnType<typeof makeUser>>
let bob: Awaited<ReturnType<typeof makeUser>>

beforeAll(async () => {
  alice = await makeUser(`alice-${Date.now()}@test.local`)
  bob = await makeUser(`bob-${Date.now()}@test.local`)
  await alice.client.from('profils').insert({ user_id: alice.id, nom: 'Alice' })
})

test('un utilisateur lit son propre profil', async () => {
  const { data } = await alice.client.from('profils').select('*').eq('user_id', alice.id)
  expect(data?.[0]?.nom).toBe('Alice')
})

test('un utilisateur ne lit pas le profil d’un autre', async () => {
  const { data } = await bob.client.from('profils').select('*').eq('user_id', alice.id)
  expect(data).toEqual([]) // RLS masque la ligne d'Alice
})
```

- [ ] **Step 4: Vérifier l'échec puis appliquer la migration**

Run (Docker lancé) :
```bash
supabase start
npm test -- rls
```
Expected : FAIL si les tables/policies ne sont pas encore appliquées, ou erreur "relation profils does not exist". `supabase start` applique les migrations ; si la migration a une erreur SQL, la corriger jusqu'à ce que `supabase start` réussisse.

- [ ] **Step 5: Faire passer les tests**

Suivre `tests/rls-setup.md` (exporter les variables `TEST_SUPABASE_*`), puis :
Run : `npm test -- rls`
Expected : PASS (les deux tests). Puis `supabase stop`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: schéma de base (5 tables) + politiques RLS + tests d'isolation"
```

---

## Task 4: Authentification + création de comptes (sans inscription publique)

**Files:**
- Create: `src/app/login/page.tsx`, `src/middleware.ts`
- Create: `supabase/seed-user.mjs`
- Test: `src/app/login/login.test.tsx`

**Interfaces:**
- Consumes : `getBrowserClient` (Task 2), `getServerClient` (Task 2).
- Produces : page `/login` fonctionnelle ; middleware qui redirige toute route protégée vers `/login` si non authentifié ; script `node supabase/seed-user.mjs <email> <motdepasse>` pour créer un compte.

- [ ] **Step 1: Écrire le test de la page login (échoue)**

Create `src/app/login/login.test.tsx` :
```tsx
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import LoginPage from './page'

vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({ auth: { signInWithPassword: vi.fn() } }),
}))

test('la page login affiche les champs email et mot de passe', () => {
  render(<LoginPage />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- login`
Expected : FAIL (module `./page` introuvable).

- [ ] **Step 3: Implémenter la page login**

Create `src/app/login/page.tsx` :
```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = getBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email ou mot de passe incorrect.')
    else router.push('/profil')
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Connexion</h1>
        <div>
          <label htmlFor="email" className="block text-sm mb-1">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-3 py-2" required />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm mb-1">Mot de passe</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-3 py-2" required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit"
          className="w-full rounded-xl px-3 py-2 text-white font-medium"
          style={{ background: 'var(--accent)' }}>Se connecter</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run : `npm test -- login`
Expected : PASS

- [ ] **Step 5: Ajouter le middleware de protection des routes**

Create `src/middleware.ts` :
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  const isProtected = ['/profil', '/offres', '/recherches'].some((p) =>
    request.nextUrl.pathname.startsWith(p))
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return response
}

export const config = { matcher: ['/profil/:path*', '/offres/:path*', '/recherches/:path*'] }
```

- [ ] **Step 6: Écrire le script de création de compte**

Create `supabase/seed-user.mjs` :
```js
// Usage : node supabase/seed-user.mjs email@exemple.fr motdepasse
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Charge .env.local sans dépendance externe
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2]
}

const [email, password] = process.argv.slice(2)
if (!email || !password) { console.error('Usage: node supabase/seed-user.mjs <email> <motdepasse>'); process.exit(1) }

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
if (error) { console.error('Erreur :', error.message); process.exit(1) }
console.log('Compte créé :', data.user.email)
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: auth email/mot de passe + middleware + script de création de compte"
```

---

## Task 5: Couche d'accès au profil (données)

**Files:**
- Create: `src/lib/profil.ts`
- Test: `src/lib/profil.test.ts`

**Interfaces:**
- Consumes : un `SupabaseClient` passé en argument (injecté pour testabilité).
- Produces :
  - `type Profil = { user_id: string; nom: string | null; titre_recherche: string | null; cv_url: string | null; lettre_base: string | null }`
  - `getProfil(client, userId): Promise<Profil | null>`
  - `upsertProfil(client, userId, patch: Partial<Omit<Profil,'user_id'>>): Promise<Profil>`

- [ ] **Step 1: Écrire les tests avec un client Supabase mocké (échoue)**

Create `src/lib/profil.test.ts` :
```ts
import { expect, test, vi } from 'vitest'
import { getProfil, upsertProfil } from './profil'

function mockClient(row: unknown) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq, single }))
  const upsert = vi.fn(() => ({ select: () => ({ single }) }))
  return { from: vi.fn(() => ({ select, upsert, eq })) } as any
}

test('getProfil renvoie la ligne', async () => {
  const client = mockClient({ user_id: 'u1', nom: 'Alice' })
  const profil = await getProfil(client, 'u1')
  expect(profil?.nom).toBe('Alice')
})

test('upsertProfil renvoie la ligne mise à jour', async () => {
  const client = mockClient({ user_id: 'u1', nom: 'Bob' })
  const profil = await upsertProfil(client, 'u1', { nom: 'Bob' })
  expect(profil.nom).toBe('Bob')
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- profil`
Expected : FAIL (module `./profil` introuvable).

- [ ] **Step 3: Implémenter la couche profil**

Create `src/lib/profil.ts` :
```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type Profil = {
  user_id: string
  nom: string | null
  titre_recherche: string | null
  cv_url: string | null
  lettre_base: string | null
}

export async function getProfil(client: SupabaseClient, userId: string): Promise<Profil | null> {
  const { data, error } = await client.from('profils').select('*').eq('user_id', userId).single()
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = aucune ligne
  return (data as Profil) ?? null
}

export async function upsertProfil(
  client: SupabaseClient,
  userId: string,
  patch: Partial<Omit<Profil, 'user_id'>>,
): Promise<Profil> {
  const { data, error } = await client
    .from('profils')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data as Profil
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run : `npm test -- profil`
Expected : PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: couche d'accès profil (get/upsert) testée"
```

---

## Task 6: Page profil (formulaire infos + lettre de base)

**Files:**
- Create: `src/app/profil/page.tsx` (Server Component : charge le profil)
- Create: `src/app/profil/profil-form.tsx` (Client Component : formulaire)
- Test: `src/app/profil/profil-form.test.tsx`

**Interfaces:**
- Consumes : `getServerClient` (Task 2), `getProfil` / `upsertProfil` (Task 5), `getBrowserClient` (Task 2).
- Produces : route `/profil` affichant et enregistrant `nom`, `titre_recherche`, `lettre_base`.

- [ ] **Step 1: Écrire le test du formulaire (échoue)**

Create `src/app/profil/profil-form.test.tsx` :
```tsx
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import ProfilForm from './profil-form'

vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({}),
}))

test('le formulaire pré-remplit les champs du profil', () => {
  render(<ProfilForm initial={{ user_id: 'u1', nom: 'Alice', titre_recherche: 'Diététicienne', cv_url: null, lettre_base: 'Bonjour' }} />)
  expect(screen.getByLabelText(/nom/i)).toHaveValue('Alice')
  expect(screen.getByLabelText(/titre recherché/i)).toHaveValue('Diététicienne')
  expect(screen.getByLabelText(/lettre de motivation de base/i)).toHaveValue('Bonjour')
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- profil-form`
Expected : FAIL (module introuvable).

- [ ] **Step 3: Implémenter le formulaire (client)**

Create `src/app/profil/profil-form.tsx` :
```tsx
'use client'
import { useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import { upsertProfil, type Profil } from '@/lib/profil'

export default function ProfilForm({ initial }: { initial: Profil }) {
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const supabase = getBrowserClient()
    await upsertProfil(supabase, initial.user_id, {
      nom: form.nom, titre_recherche: form.titre_recherche, lettre_base: form.lettre_base,
    })
    setSaved(true)
  }

  return (
    <form onSubmit={save} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="nom" className="block text-sm mb-1">Nom</label>
        <input id="nom" value={form.nom ?? ''} onChange={(e) => setForm({ ...form, nom: e.target.value })}
          className="w-full rounded-xl border px-3 py-2" />
      </div>
      <div>
        <label htmlFor="titre" className="block text-sm mb-1">Titre recherché</label>
        <input id="titre" value={form.titre_recherche ?? ''} onChange={(e) => setForm({ ...form, titre_recherche: e.target.value })}
          className="w-full rounded-xl border px-3 py-2" />
      </div>
      <div>
        <label htmlFor="lettre" className="block text-sm mb-1">Lettre de motivation de base</label>
        <textarea id="lettre" rows={8} value={form.lettre_base ?? ''} onChange={(e) => setForm({ ...form, lettre_base: e.target.value })}
          className="w-full rounded-xl border px-3 py-2" />
      </div>
      <button type="submit" className="rounded-xl px-4 py-2 text-white font-medium" style={{ background: 'var(--accent)' }}>
        Enregistrer
      </button>
      {saved && <span className="ml-3 text-sm" style={{ color: 'var(--accent)' }}>Enregistré ✓</span>}
    </form>
  )
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run : `npm test -- profil-form`
Expected : PASS

- [ ] **Step 5: Implémenter la page serveur qui charge le profil**

Create `src/app/profil/page.tsx` :
```tsx
import { getServerClient } from '@/lib/supabase/server'
import { getProfil, type Profil } from '@/lib/profil'
import ProfilForm from './profil-form'

export default async function ProfilPage() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const existing = user ? await getProfil(supabase, user.id) : null
  const initial: Profil = existing ?? {
    user_id: user!.id, nom: null, titre_recherche: null, cv_url: null, lettre_base: null,
  }
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Mon profil</h1>
      <ProfilForm initial={initial} />
    </main>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: page profil (infos + lettre de base)"
```

---

## Task 7: Upload du CV (PDF) vers Supabase Storage

**Files:**
- Modify: `src/lib/profil.ts` (ajouter `uploadCv`)
- Modify: `src/app/profil/profil-form.tsx` (ajouter le champ fichier)
- Test: `src/lib/profil.test.ts` (ajouter un test `uploadCv`)

**Interfaces:**
- Consumes : `upsertProfil` (Task 5), un `SupabaseClient`.
- Produces : `uploadCv(client, userId, file: File): Promise<string>` — téléverse le PDF sous `cv/<userId>/cv.pdf`, met à jour `profils.cv_url`, renvoie le chemin stocké.

- [ ] **Step 1: Ajouter le test `uploadCv` (échoue)**

Add to `src/lib/profil.test.ts` :
```ts
test('uploadCv téléverse sous le préfixe user et renvoie le chemin', async () => {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'u1/cv.pdf' }, error: null })
  const single = vi.fn().mockResolvedValue({ data: { user_id: 'u1', cv_url: 'u1/cv.pdf' }, error: null })
  const client = {
    storage: { from: vi.fn(() => ({ upload })) },
    from: vi.fn(() => ({ upsert: () => ({ select: () => ({ single }) }) })),
  } as any
  const { uploadCv } = await import('./profil')
  const file = new File(['%PDF-'], 'cv.pdf', { type: 'application/pdf' })
  const path = await uploadCv(client, 'u1', file)
  expect(path).toBe('u1/cv.pdf')
  expect(client.storage.from).toHaveBeenCalledWith('cv')
  expect(upload).toHaveBeenCalledWith('u1/cv.pdf', file, expect.objectContaining({ upsert: true }))
})
```

- [ ] **Step 2: Vérifier l'échec**

Run : `npm test -- profil`
Expected : FAIL (`uploadCv` non exporté).

- [ ] **Step 3: Implémenter `uploadCv`**

Add to `src/lib/profil.ts` :
```ts
export async function uploadCv(client: SupabaseClient, userId: string, file: File): Promise<string> {
  const path = `${userId}/cv.pdf`
  const { error } = await client.storage.from('cv').upload(path, file, {
    upsert: true, contentType: 'application/pdf',
  })
  if (error) throw error
  await upsertProfil(client, userId, { cv_url: path })
  return path
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run : `npm test -- profil`
Expected : PASS (tous les tests profil).

- [ ] **Step 5: Ajouter le champ fichier au formulaire**

Add inside the form in `src/app/profil/profil-form.tsx`, before the submit button :
```tsx
      <div>
        <label htmlFor="cv" className="block text-sm mb-1">CV (PDF)</label>
        <input id="cv" type="file" accept="application/pdf"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const supabase = getBrowserClient()
            const { uploadCv } = await import('@/lib/profil')
            await uploadCv(supabase, initial.user_id, file)
            setSaved(true)
          }}
          className="w-full text-sm" />
        {form.cv_url && <p className="text-xs mt-1 text-gray-500">CV actuel : {form.cv_url}</p>}
      </div>
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: upload du CV (PDF) vers Supabase Storage"
```

---

## Task 8: Vérification manuelle de bout en bout

**Files:** aucun (validation).

- [ ] **Step 1: Créer un compte de test**

Run : `node supabase/seed-user.mjs toi@exemple.fr motdepasse123`
Expected : "Compte créé : toi@exemple.fr"

- [ ] **Step 2: Lancer l'app**

Run : `npm run dev`
Ouvrir http://localhost:3000 → doit afficher "JobCompass".

- [ ] **Step 3: Se connecter**

Aller sur http://localhost:3000/profil → redirigé vers /login (middleware). Se connecter avec le compte créé → arrive sur /profil.

- [ ] **Step 4: Renseigner le profil**

Remplir nom, titre recherché, lettre de base, enregistrer → "Enregistré ✓". Recharger la page → les valeurs persistent.

- [ ] **Step 5: Téléverser un CV**

Choisir un PDF → "Enregistré ✓". Dans le dashboard Supabase (Storage → bucket `cv`), vérifier la présence de `<user_id>/cv.pdf`.

- [ ] **Step 6: Lancer toute la suite de tests**

Run : `npm test`
Expected : tous les tests unitaires PASS (les tests `rls` nécessitent Supabase local + variables `TEST_SUPABASE_*` ; les lancer séparément selon `tests/rls-setup.md`).

---

## Self-Review (rempli à la rédaction)

- **Couverture spec** : comptes/login (Task 4), RLS/isolation (Task 3), profil + CV + lettre de base (Tasks 5-7), thème Montserrat/accent vert (Task 1), schéma des 5 tables incluant `offres`/`resultats`/`recherches` pour les plans suivants (Task 3). Collecteur, recherche, liste et carte : **hors périmètre de ce plan** (plans 2 et 3).
- **Placeholders** : aucun ; chaque étape contient le code réel.
- **Cohérence des types** : `Profil` défini en Task 5 et réutilisé tel quel en Tasks 6-7 ; noms de colonnes alignés sur le SQL de la Task 3 (`titre_recherche`, `lettre_base`, `cv_url`).
- **Note d'exécution** : les tests RLS (Task 3) exigent Docker + Supabase local ; les autres tâches n'en dépendent pas et peuvent être développées avec le projet Supabase distant.
```
