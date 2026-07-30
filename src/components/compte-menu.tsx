'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'

export default function CompteMenu() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const pathname = usePathname()

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('#account')) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  useEffect(() => {
    let annule = false
    const client = getBrowserClient()
    client.auth.getUser().then(({ data }) => {
      if (!annule) setEmail(data.user?.email ?? '')
    }).catch(() => {})
    // Met à jour l'avatar immédiatement après connexion/déconnexion, sans refresh.
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (!annule) setEmail(session?.user?.email ?? '')
    })
    return () => { annule = true; sub.subscription.unsubscribe() }
  }, [])

  if (pathname === '/login') return null

  const initiale = (email.trim()[0] ?? '?').toUpperCase()

  const logout = async () => {
    await getBrowserClient().auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="account" id="account">
      <button
        className="avatar-btn"
        aria-label="Mon compte"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
      >
        <span className="ava">{initiale}</span>
      </button>
      <div className={`acc-menu${open ? ' on' : ''}`}>
        <div className="acc-head">
          <span className="ava lg">{initiale}</span>
          <div className="acc-id">
            <span>{email || 'Connexion en cours...'}</span>
          </div>
        </div>
        <div className="acc-sep" />
        <a href="/profil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
          <span>Mon profil</span>
        </a>
        <a href="/favoris">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
          <span>Mes offres likées</span>
        </a>
        <a href="/suivi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
          <span>Suivi des candidatures</span>
        </a>
        <a href="/parametres">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
          <span>Paramètres du compte</span>
        </a>
        <div className="acc-sep" />
        <button type="button" className="danger" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  )
}
