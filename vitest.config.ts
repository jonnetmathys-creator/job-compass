import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // tests/** contient les tests d'intégration RLS (Supabase local requis via
    // TEST_SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY, voir tests/rls-setup.md).
    // Exclu du run par défaut (`npm test`) pour ne pas casser la suite unitaire
    // en l'absence d'environnement Supabase. Réintégré uniquement quand
    // TEST_SUPABASE_URL est exporté, ce que fait rls-setup.md avant
    // `npm test -- rls`.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      ...(process.env.TEST_SUPABASE_URL ? [] : ['tests/**']),
    ],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
