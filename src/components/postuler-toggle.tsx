'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { marquerPostulee, retirerDuSuivi } from '@/lib/suivi/actions'

export default function PostulerToggle({ offreId, statutInitial }: { offreId: string; statutInitial: string }) {
  const [postule, setPostule] = useState(statutInitial !== 'brouillon')
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function marquer() {
    setErreur(null); setPostule(true)
    startTransition(async () => {
      try { await marquerPostulee(offreId) } catch { setPostule(false); setErreur('Échec, réessaie.') }
    })
  }

  function annuler() {
    setErreur(null); setPostule(false)
    startTransition(async () => {
      try { await retirerDuSuivi(offreId) } catch { setPostule(true); setErreur('Échec, réessaie.') }
    })
  }

  if (!postule) {
    return (
      <div className="postuler-toggle">
        <button type="button" className="btn-apply" onClick={marquer} disabled={isPending}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          J&apos;ai postulé
        </button>
        {erreur && <span className="cand-err">{erreur}</span>}
      </div>
    )
  }

  return (
    <div className="postuler-toggle done">
      <span className="postuler-badge">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        Postulé
      </span>
      <Link href="/suivi" className="postuler-link">Voir le suivi</Link>
      <button type="button" className="postuler-annuler" onClick={annuler} disabled={isPending}>Annuler</button>
      {erreur && <span className="cand-err">{erreur}</span>}
    </div>
  )
}
