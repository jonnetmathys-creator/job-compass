'use client'
import { useEffect, useState } from 'react'

// Écran de lancement animé (une fois par session). Boussole qui se dessine +
// aiguille qui pivote et se cale au nord, puis le nom apparaît, puis fondu.
export default function SplashScreen() {
  const [visible, setVisible] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    let deja = false
    try { deja = sessionStorage.getItem('jc-splash') === '1' } catch { /* ignore */ }
    if (deja) return
    try { sessionStorage.setItem('jc-splash', '1') } catch { /* ignore */ }
    setVisible(true)
    const t1 = setTimeout(() => setFadeOut(true), 1650)
    const t2 = setTimeout(() => setVisible(false), 2100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!visible) return null
  return (
    <div className={`splash${fadeOut ? ' out' : ''}`} aria-hidden="true">
      <div className="splash-inner">
        <svg className="splash-compass" viewBox="0 0 100 100">
          <circle className="s-ring" cx="50" cy="50" r="42" />
          <circle className="s-ring s-ring2" cx="50" cy="50" r="42" />
          <g className="s-needle">
            <polygon className="s-n" points="50,15 58,50 42,50" />
            <polygon className="s-s" points="50,85 58,50 42,50" />
          </g>
          <circle className="s-hub" cx="50" cy="50" r="4.5" />
        </svg>
        <div className="splash-word">Job<span>Compass</span></div>
      </div>
    </div>
  )
}
