'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { marquerPostulee } from '@/lib/suivi/actions'
import { enregistrerRappel, cloreRappel } from '@/lib/rappels/actions'

export type ReponsePostuler = 'non' | 'pas_encore' | 'oui'

export default function PostulerModal({ offreId, onFini }: { offreId: string; onFini: (r: ReponsePostuler) => void }) {
  const [pending, setPending] = useState<ReponsePostuler | null>(null)
  const [monte, setMonte] = useState(false)

  useEffect(() => { setMonte(true) }, [])

  async function repondre(r: ReponsePostuler) {
    if (pending) return
    setPending(r)
    try {
      if (r === 'oui') { await marquerPostulee(offreId); await cloreRappel(offreId) }
      else if (r === 'pas_encore') { await enregistrerRappel(offreId) }
    } catch { /* non bloquant : on ferme quand même */ }
    onFini(r)
  }

  if (!monte) return null
  return createPortal(
    <div className="pm-overlay" role="dialog" aria-modal="true" aria-label="Avez-vous postulé ?">
      <div className="pm-card">
        <div className="pm-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>
        </div>
        <h3 className="pm-titre">Avez-vous postulé à cette offre ?</h3>
        <p className="pm-sous">Ta réponse met à jour ton suivi de candidatures.</p>
        <div className="pm-actions">
          <button type="button" className="pm-btn pm-non" disabled={!!pending} onClick={() => repondre('non')}>
            {pending === 'non' ? '…' : 'Non'}
          </button>
          <button type="button" className="pm-btn pm-attente" disabled={!!pending} onClick={() => repondre('pas_encore')}>
            {pending === 'pas_encore' ? '…' : 'Pas encore'}
          </button>
          <button type="button" className="pm-btn pm-oui" disabled={!!pending} onClick={() => repondre('oui')}>
            {pending === 'oui' ? '…' : 'Oui'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
