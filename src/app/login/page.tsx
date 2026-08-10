'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Message après un retour depuis le lien de confirmation d'email.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('confirmed') === '1') setInfo('Adresse confirmée. Connecte-toi pour accéder à ton compte.')
    else if (params.get('erreur') === 'confirmation') setError('Lien de confirmation invalide ou expiré. Réessaie ou recrée un compte.')
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = getBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email ou mot de passe incorrect.')
    else router.push('/')
  }

  return (
    <main style={{ position: 'relative', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, overflow: 'hidden', background: 'radial-gradient(1100px 620px at 50% -12%, var(--accent-soft), transparent 62%)' }}>
      <div className="decor" aria-hidden>
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
        <div className="ring r1" /><div className="ring r2" />
        <svg className="compass" width="150" height="150" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="34" />
          <polygon points="50,20 58,50 50,80 42,50" fill="currentColor" stroke="none" opacity=".7" />
          <circle cx="50" cy="50" r="3" fill="currentColor" stroke="none" />
        </svg>
        <svg className="dotgrid" width="120" height="120" viewBox="0 0 120 120" fill="currentColor">
          <circle cx="10" cy="10" r="2" /><circle cx="40" cy="10" r="2" /><circle cx="70" cy="10" r="2" /><circle cx="100" cy="10" r="2" />
          <circle cx="10" cy="40" r="2" /><circle cx="40" cy="40" r="2" /><circle cx="70" cy="40" r="2" /><circle cx="100" cy="40" r="2" />
          <circle cx="10" cy="70" r="2" /><circle cx="40" cy="70" r="2" /><circle cx="70" cy="70" r="2" /><circle cx="100" cy="70" r="2" />
          <circle cx="10" cy="100" r="2" /><circle cx="40" cy="100" r="2" /><circle cx="70" cy="100" r="2" /><circle cx="100" cy="100" r="2" />
        </svg>
      </div>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4" style={{ position: 'relative', zIndex: 1 }}>
        <div className="logo" style={{ fontSize: 24, marginBottom: 8 }}>Job<span>Compass</span></div>
        <h1 className="text-xl font-semibold">Connexion</h1>
        {info && <p className="text-sm" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>{info}</p>}
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
        <button type="submit" className="w-full rounded-xl px-3 py-2 text-white font-medium btn-auth">Se connecter</button>
        <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
          Pas encore de compte ? <a href="/signup" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>Créer un compte</a>
        </p>
      </form>
    </main>
  )
}
