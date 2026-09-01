'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type ActionIA = { cle: string; label: string; consigne: string; path: string }
type Cote = 'top' | 'bottom' | 'left' | 'right'

const MARGE = 20

// Dock IA déplaçable, avec 4 emplacements fixes (centrés sur chaque bord). On
// l'attrape par la poignée : il suit le curseur, un repère clignotant montre le
// bord visé, et au relâcher il s'aimante au centre de ce bord. Cas particulier :
// collé EN HAUT, il se place dans le flux (entre onglets et lettre, il pousse la
// lettre vers le bas) ; sur les autres bords il flotte au-dessus. Choix mémorisé.
export default function BarreIA({
  actions, iaEnCours, disabled, onAction, ton, onTonChange, onTonApply,
}: {
  actions: ActionIA[]
  iaEnCours: string | null
  disabled: boolean
  onAction: (consigne: string, cle: string) => void
  ton: number
  onTonChange: (v: number) => void
  onTonApply: (v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)
  const [cote, setCote] = useState<Cote>('bottom')
  const [cible, setCible] = useState<Cote>('bottom')
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const orient = cote === 'left' || cote === 'right' ? 'v' : 'h'
  const enflux = cote === 'top' && !dragging // dans le flux quand collé en haut

  function bordProche(x: number, y: number): Cote {
    const vw = window.innerWidth, vh = window.innerHeight
    const d: Record<Cote, number> = { left: x, right: vw - x, top: y, bottom: vh - y }
    return (Object.keys(d) as Cote[]).reduce((a, b) => (d[a] <= d[b] ? a : b))
  }

  // Centre du dock au repos pour bas/gauche/droite (le haut est géré en flux, sans coords).
  const recompute = useCallback(() => {
    if (dragRef.current || cote === 'top') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    const hw = r.width / 2, hh = r.height / 2
    let x = vw / 2, y = vh - hh - MARGE
    if (cote === 'left') { x = hw + MARGE; y = vh / 2 }
    else if (cote === 'right') { x = vw - hw - MARGE; y = vh / 2 }
    setCoords({ x, y })
  }, [cote])

  useLayoutEffect(() => { recompute() }, [recompute, orient])
  useEffect(() => {
    const onR = () => recompute()
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [recompute])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('jc-ia-dock')
      const c = raw ? JSON.parse(raw)?.cote : null
      if (c === 'top' || c === 'bottom' || c === 'left' || c === 'right') setCote(c)
    } catch { /* stockage indisponible : on garde le défaut */ }
  }, [])

  function onPointerDown(e: React.PointerEvent) {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = true
    setDragging(true)
    setCoords({ x: e.clientX, y: e.clientY })
    setCible(bordProche(e.clientX, e.clientY))
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    setCoords({ x: e.clientX, y: e.clientY })
    setCible(bordProche(e.clientX, e.clientY))
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragRef.current) return
    dragRef.current = false
    setDragging(false)
    const best = bordProche(e.clientX, e.clientY)
    setCote(best)
    try { localStorage.setItem('jc-ia-dock', JSON.stringify({ cote: best })) } catch { /* ignore */ }
  }

  // Style du dock : suit le curseur pendant le glissement ; sinon flottant
  // (bas/gauche/droite) ou rien (le haut passe en flux via la classe .enflux).
  const style: React.CSSProperties = dragging
    ? { position: 'fixed', left: coords?.x, top: coords?.y, transform: 'translate(-50%, -50%)', transition: 'none' }
    : enflux
      ? {}
      : coords
        ? { position: 'fixed', left: coords.x, top: coords.y, transform: 'translate(-50%, -50%)', transition: 'left .24s ease, top .24s ease' }
        : { position: 'fixed', left: '50%', bottom: 18, transform: 'translateX(-50%)' }

  // Repère : zone centrée sur le bord visé, calée sur l'emplacement réel du dock.
  // Le haut est dans le flux (au-dessus de la lettre) : on vise le haut de la feuille.
  let cibleStyle: React.CSSProperties = {}
  if (cible === 'top') {
    let top = 96
    if (dragging && typeof document !== 'undefined') {
      const f = document.querySelector('.cand-feuille-wrap')
      if (f) top = (f as HTMLElement).getBoundingClientRect().top - 6
    }
    cibleStyle = { left: '50%', top, transform: 'translate(-50%, -100%)' }
  } else if (cible === 'bottom') cibleStyle = { left: '50%', bottom: 20, transform: 'translateX(-50%)' }
  else if (cible === 'left') cibleStyle = { left: 20, top: '50%', transform: 'translateY(-50%)' }
  else cibleStyle = { right: 20, top: '50%', transform: 'translateY(-50%)' }

  return (
    <>
      {dragging ? <div className={`cand-ia-cible ${cible}`} style={cibleStyle} aria-hidden="true" /> : null}
      <div ref={ref} className={`cand-ia-bar ${orient}${dragging ? ' dragging' : ''}${enflux ? ' enflux' : ''}`} style={style} aria-busy={iaEnCours ? true : undefined}>
        <button
          type="button" className="cand-ia-handle" aria-label="Déplacer la barre IA"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
        </button>
        <span className="cand-ia-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z" /></svg>
          IA
        </span>
        {actions.map((a) => (
          <button key={a.cle} type="button" className="cand-ia-chip" disabled={disabled || !!iaEnCours} onClick={() => onAction(a.consigne, a.cle)}>
            {iaEnCours === a.cle
              ? <span className="cand-ia-spin" />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={a.path} /></svg>}
            {a.label}
          </button>
        ))}
        <span className="cand-ia-sep" />
        <span className="cand-ia-ton">
          <span className="cand-ia-ton-cap">Ton</span>
          <span className="cand-ia-ton-lbl">Sobre</span>
          <input
            type="range" min={0} max={100} value={ton} disabled={disabled || !!iaEnCours}
            onChange={(e) => onTonChange(Number(e.target.value))}
            onMouseUp={(e) => onTonApply(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => onTonApply(Number((e.target as HTMLInputElement).value))}
            aria-label="Ton de la lettre (sobre à chaleureux)"
          />
          <span className="cand-ia-ton-lbl">Chaleureux</span>
        </span>
      </div>
    </>
  )
}
