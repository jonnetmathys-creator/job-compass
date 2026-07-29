'use client'
import { useState, useTransition } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'

export default function ParametresForm({ email }: { email: string }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; texte: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function updatePassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (password !== confirmation) {
      setMessage({ type: 'error', texte: 'Les mots de passe ne correspondent pas.' })
      return
    }

    startTransition(async () => {
      const { error } = await getBrowserClient().auth.updateUser({ password })
      if (error) {
        setMessage({ type: 'error', texte: 'Échec de la mise à jour, réessayez.' })
        return
      }
      setPassword('')
      setConfirmation('')
      setMessage({ type: 'success', texte: 'Mot de passe mis à jour.' })
    })
  }

  async function logout() {
    await getBrowserClient().auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="side-card" style={{ padding: '22px 22px 26px' }}>
      <div className="side-row">
        <span>Adresse e-mail</span>
        <b>{email}</b>
      </div>

      <form onSubmit={updatePassword} className="space-y-5" style={{ paddingTop: 18 }}>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Nouveau mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
        </div>
        <div>
          <label htmlFor="confirmation" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Confirmation
          </label>
          <input
            id="confirmation"
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
          </button>
        </div>
        {message && (
          <p
            className="text-sm mt-1"
            style={{ color: message.type === 'error' ? '#e2565b' : 'var(--accent)' }}
          >
            {message.texte}
          </p>
        )}
      </form>

      <div style={{ paddingTop: 22, marginTop: 4, borderTop: '1px solid var(--line)' }}>
        <button type="button" className="btn-primary" style={{ background: '#d14343', boxShadow: 'none' }} onClick={logout}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
