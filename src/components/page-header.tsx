'use client'
import Link from 'next/link'

export default function PageHeader({ titre = 'Retour' }: { titre?: string }) {
  return (
    <div className="detail-top">
      <button
        type="button"
        className="back"
        onClick={() => {
          if (typeof window !== 'undefined' && window.history.length > 1) history.back()
          else window.location.href = '/'
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
        {titre}
      </button>
      <Link href="/" className="logo" aria-label="Retour à la recherche">Job<span>Compass</span></Link>
    </div>
  )
}
