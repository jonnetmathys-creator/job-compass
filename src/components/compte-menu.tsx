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
    getBrowserClient().auth.getUser().then(({ data }) => {
      if (!annule) setEmail(data.user?.email ?? '')
    }).catch(() => {})
    return () => { annule = true }
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
        <a href="/profil">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
          <span>Mes offres likées</span>
        </a>
        <a href="/parametres">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 5 9.4l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 6.6h.09A1.65 1.65 0 0 0 11 5V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 19 8l.06-.06a2 2 0 1 1 2.83 2.83L21.4 11a1.65 1.65 0 0 0 1.6 4Z" /></svg>
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
