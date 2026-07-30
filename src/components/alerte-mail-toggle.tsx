'use client'
import { useState, useTransition } from 'react'
import { basculerAlertesEmail } from '@/lib/alertes/actions'

export default function AlerteMailToggle({ rechercheId, actifInitial }: { rechercheId: string; actifInitial: boolean }) {
  const [actif, setActif] = useState(actifInitial)
  const [anim, setAnim] = useState(0)
  const [isPending, startTransition] = useTransition()

  function basculer() {
    const cible = !actif
    setActif(cible)
    if (cible) setAnim((n) => n + 1) // secousse + ondes uniquement à l'activation
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
      <span className="alerte-cloche" key={anim} data-anim={anim > 0 ? '1' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {anim > 0 && <span className="alerte-ondes" aria-hidden="true"><i /><i /><i /></span>}
      </span>
      Alertes mail
    </button>
  )
}
