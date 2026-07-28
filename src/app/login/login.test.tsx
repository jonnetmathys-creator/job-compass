import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import LoginPage from './page'

vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({ auth: { signInWithPassword: vi.fn() } }),
}))

// Next.js 16 : useRouter() lève une invariant error hors contexte App Router.
// Le rendu isolé (React Testing Library) ne monte pas ce contexte, donc on
// mocke next/navigation pour permettre le rendu du formulaire (seul point
// testé ici, cf. brief tâche 4).
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

test('la page login affiche les champs email et mot de passe', () => {
  render(<LoginPage />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument()
})
