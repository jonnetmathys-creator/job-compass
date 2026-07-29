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
        <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
          Pas encore de compte ? <a href="/signup" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>Créer un compte</a>
        </p>
      </form>
    </main>
  )
}
