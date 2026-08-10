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
  const [popup, setPopup] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    const supabase = getBrowserClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError("Impossible de créer le compte, réessayez."); return }
    // Si la confirmation d'email est désactivée, une session est ouverte directement.
    if (data.session) { router.push('/') }
    else { setPopup(true) }
  }

  return (
    <main style={{ position: 'relative', minHeight: 'calc(100vh - 56px)', display: 'grid', placeItems: 'center', padding: 24, overflow: 'hidden', background: 'radial-gradient(1100px 620px at 50% -12%, var(--accent-soft), transparent 62%)' }}>
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
        <button type="submit" className="w-full rounded-xl px-3 py-2 text-white font-medium btn-auth">Créer mon compte</button>
        <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
          Déjà un compte ? <a href="/login" style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>Se connecter</a>
        </p>
      </form>

      {popup && (
        <div className="pm-overlay" role="dialog" aria-modal="true" aria-label="Compte créé">
          <div className="pm-card">
            <div className="pm-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></svg>
            </div>
            <h3 className="pm-titre">Vérifie ta boîte mail</h3>
            <p className="pm-sous">On vient d&apos;envoyer un lien de confirmation à <b>{email}</b>. Clique dessus pour valider ton adresse, puis connecte-toi.</p>
            <div className="pm-actions">
              <button type="button" className="pm-btn pm-oui" onClick={() => router.push('/login')}>J&apos;ai compris</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
