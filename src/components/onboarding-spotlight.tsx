'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Etape } from '@/lib/onboarding/etapes'

export type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6 // marge du halo autour de la cible
const MARGE = 12 // marge minimale avec les bords de l'écran
const ECART = 16 // écart entre la cible et la bulle

type Pos = { top: number; left: number }

// Position de la bulle : ancrée selon le placement souhaité, puis bornée pour rester
// entièrement visible à l'écran (jamais coupée en haut, en bas ou sur les côtés).
function calculerPos(rect: Rect, placement: Etape['placement'], bw: number, bh: number, vw: number, vh: number): Pos {
  let top: number, left: number
  switch (placement) {
    case 'haut': top = rect.top - ECART - bh; left = rect.left + rect.width / 2 - bw / 2; break
    case 'gauche': left = rect.left - ECART - bw; top = rect.top + rect.height / 2 - bh / 2; break
    case 'droite': left = rect.left + rect.width + ECART; top = rect.top + rect.height / 2 - bh / 2; break
    default: top = rect.top + rect.height + ECART; left = rect.left + rect.width / 2 - bw / 2; break
  }
  left = Math.max(MARGE, Math.min(left, vw - bw - MARGE))
  top = Math.max(MARGE, Math.min(top, vh - bh - MARGE))
  return { top, left }
}

export default function OnboardingSpotlight(props: {
  etape: Etape; rect: Rect | null; index: number; total: number; suivantLabel: string
  onPrecedent: () => void; onSuivant: () => void; onPasser: () => void
}) {
  const { rect, etape } = props
  const bulleRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Pos | null>(null)

  // Mesure la bulle une fois rendue, puis calcule sa position bornée (avant peinture,
  // donc sans clignotement). Se recalcule à chaque changement d'étape ou de cible.
  useLayoutEffect(() => {
    if (!rect || !bulleRef.current) { setPos(null); return }
    const b = bulleRef.current.getBoundingClientRect()
    const vw = window.innerWidth || 1024
    const vh = window.innerHeight || 768
    setPos(calculerPos(rect, etape.placement, b.width || 300, b.height || 220, vw, vh))
  }, [rect, etape.placement, etape.id])

  if (typeof document === 'undefined') return null

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
      <div
        ref={bulleRef}
        className="tour-bulle"
        style={pos ? { top: pos.top, left: pos.left } : { top: rect.top, left: rect.left, visibility: 'hidden' }}
      >
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
