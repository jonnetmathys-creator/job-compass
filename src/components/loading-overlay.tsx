'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Overlay plein écran : fond assombri + flou, visuel radar « recherche »
// on-brand (JobCompass), et un message qui défile pour faire patienter.
// Rendu via un portal sur <body> pour ne pas être piégé par un ancêtre
// transformé (position: fixed se cale sinon sur cet ancêtre, pas l'écran).
export default function LoadingOverlay({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (messages.length <= 1) return
    const id = setInterval(() => setI((v) => (v + 1) % messages.length), 1900)
    return () => clearInterval(id)
  }, [messages.length])

  if (!mounted) return null

  return createPortal(
    <div className="lo-overlay" role="status" aria-live="polite">
      <div className="lo-card">
        <div className="lo-radar" aria-hidden="true">
          <span className="lo-ring" />
          <span className="lo-ring" />
          <span className="lo-ring" />
          <span className="lo-sweep" />
          <span className="lo-core">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </span>
        </div>
        <div className="lo-msg" key={i}>{messages[i]}</div>
      </div>
    </div>,
    document.body,
  )
}
