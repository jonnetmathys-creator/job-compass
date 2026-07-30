'use client'
import { createPortal } from 'react-dom'
import type { Etape } from '@/lib/onboarding/etapes'

export type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6 // marge du halo autour de la cible

// Position de la bulle selon le placement demandé, calée sur le rectangle de la cible.
function styleBulle(rect: Rect, placement: Etape['placement']): React.CSSProperties {
  const g = 16
  switch (placement) {
    case 'haut': return { top: rect.top - g, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' }
    case 'gauche': return { top: rect.top + rect.height / 2, left: rect.left - g, transform: 'translate(-100%, -50%)' }
    case 'droite': return { top: rect.top + rect.height / 2, left: rect.left + rect.width + g, transform: 'translate(0, -50%)' }
    default: return { top: rect.top + rect.height + g, left: rect.left + rect.width / 2, transform: 'translate(-50%, 0)' }
  }
}

export default function OnboardingSpotlight(props: {
  etape: Etape; rect: Rect | null; index: number; total: number; suivantLabel: string
  onPrecedent: () => void; onSuivant: () => void; onPasser: () => void
}) {
  if (typeof document === 'undefined') return null
  const { rect, etape } = props

  // Pause : la cible n'est pas (encore) sur la page. On garde une sortie possible.
  if (!rect) {
    return createPortal(
      <div className="tour-pause">
        <span>Reprise du tutoriel…</span>
        <button type="button" onClick={props.onPasser}>Passer le tutoriel</button>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div className="tour-couche" role="dialog" aria-modal="true" aria-label={etape.titre}>
      <div className="tour-trou" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
      <div className="tour-bulle" style={styleBulle(rect, etape.placement)}>
        <div className="tour-bulle-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
        <h4 className="tour-bulle-titre">{etape.titre}</h4>
        <p className="tour-bulle-texte">{etape.texte}</p>
        <div className="tour-points" aria-hidden>
          {Array.from({ length: props.total }, (_, i) => <span key={i} className={i === props.index ? 'on' : ''} />)}
        </div>
        <div className="tour-actions">
          <button type="button" className="tour-passer" onClick={props.onPasser}>Passer</button>
          <div className="tour-nav">
            {props.index > 0 && <button type="button" className="tour-prec" onClick={props.onPrecedent}>Précédent</button>}
            <button type="button" className="tour-suiv" onClick={props.onSuivant}>{props.suivantLabel}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
