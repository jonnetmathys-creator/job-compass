'use client'
import { useState, useTransition } from 'react'
import { basculerAlertesEmail } from '@/lib/alertes/actions'

export default function AlerteMailToggle({ rechercheId, actifInitial }: { rechercheId: string; actifInitial: boolean }) {
  const [actif, setActif] = useState(actifInitial)
  const [isPending, startTransition] = useTransition()

  function basculer() {
    const cible = !actif
    setActif(cible)
    startTransition(async () => {
      try { const r = await basculerAlertesEmail(rechercheId); setActif(r.actif) } catch { setActif(!cible) }
    })
  }

  return (
    <button
      type="button"
      className={`alerte-toggle${actif ? ' on' : ''}`}
      aria-pressed={actif}
      onClick={basculer}
      disabled={isPending}
      title="Recevoir les nouvelles offres par email"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      Alertes mail
    </button>
  )
}
