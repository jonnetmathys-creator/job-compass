'use client'
import { useTransition } from 'react'
import { reinitialiserOnboarding } from '@/lib/onboarding/actions'

export default function OnboardingRejouer() {
  const [pending, startTransition] = useTransition()

  function rejouer() {
    localStorage.setItem('jc_tour_relance', '1')
    localStorage.setItem('jc_tour_index', '0')
    startTransition(async () => {
      try { await reinitialiserOnboarding() } catch { /* non bloquant */ }
      window.location.assign('/')
    })
  }

  return (
    <button type="button" className="profil-tuto" onClick={rejouer} disabled={pending}>
      <span className="profil-tuto-ico">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
      </span>
      <span className="profil-tuto-txt"><b>Revoir le tutoriel</b><small>Relance la visite guidée de l’app</small></span>
    </button>
  )
}
