'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Palette dans le thème de l'app (verts + une touche dorée).
const COULEURS = ['#2e9e5b', '#248049', '#7bd0a0', '#a8e6c1', '#cdeede', '#f4c542']

// Pseudo-aléatoire déterministe (pas de Math.random : rendu stable, pas de souci d'hydratation).
function rand(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

// Petite pluie de confettis, affichée brièvement puis retirée (onFini).
export default function Confetti({ onFini }: { onFini?: () => void }) {
  const [monte, setMonte] = useState(false)
  useEffect(() => {
    setMonte(true)
    const t = setTimeout(() => onFini?.(), 2800)
    return () => clearTimeout(t)
  }, [onFini])
  if (!monte || typeof document === 'undefined') return null

  const pieces = Array.from({ length: 80 }, (_, i) => {
    const left = rand(i + 1) * 100
    const drift = (rand(i + 2) - 0.5) * 160
    const rot = rand(i + 3) * 720
    const delay = rand(i + 4) * 400
    const dur = 1900 + rand(i + 5) * 1400
    const taille = 7 + rand(i + 6) * 6
    const couleur = COULEURS[i % COULEURS.length]
    const style = {
      left: `${left}%`,
      width: `${taille}px`,
      height: `${taille * 1.5}px`,
      background: couleur,
      animationDelay: `${delay}ms`,
      animationDuration: `${dur}ms`,
      '--drift': `${drift}px`,
      '--rot': `${rot}deg`,
    } as React.CSSProperties
    return <span key={i} className="confetti-piece" style={style} />
  })

  return createPortal(<div className="confetti" aria-hidden>{pieces}</div>, document.body)
}
