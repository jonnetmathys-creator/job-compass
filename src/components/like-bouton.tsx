'use client'
import { useRef } from 'react'

const HEART = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
  </svg>
)

export default function LikeBouton({ liked, onToggle }: { liked: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <button ref={ref} className={`like${liked ? ' on' : ''}`} aria-label="Aimer cette offre"
      onClick={(e) => {
        e.stopPropagation()
        if (!liked && ref.current) { ref.current.classList.remove('pop'); void ref.current.offsetWidth; ref.current.classList.add('pop'); setTimeout(() => ref.current?.classList.remove('pop'), 560) }
        onToggle()
      }}>
      {HEART}
    </button>
  )
}
