'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null)
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    const supabase = getBrowserClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError("Impossible de créer le compte, réessayez."); return }
    // Si la confirmation d'email est désactivée, une session est ouverte directement.
    if (data.session) { router.push('/profil') }
    else { setInfo('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.') }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <div className="logo" style={{ fontSize: 24, marginBottom: 8 }}>Job<span>Compass</span></div>
        <h1 className="text-xl font-semibold">Créer un compte</h1>
        <div>
          <label htmlFor="email" className="block text-sm mb-1">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]" required />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm mb-1">Mot de passe</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]" required />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm mb-1">Confirmer le mot de passe</label>
          <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]" required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm" style={{ color: 'var(--accent-dark)' }}>{info}</p>}
        <button type="submit"
          className="w-full rounded-xl px-3 py-2 text-white font-medium"
          style={{ background: 'var(--accent)' }}>Créer mon compte</button>
        <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
          Déjà un compte ? <a href="/login" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>Se connecter</a>
        </p>
      </form>
    </main>
  )
}
