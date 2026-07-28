'use client'

export default function PageHeader({ titre = 'Retour' }: { titre?: string }) {
  return (
    <div className="detail-top">
      <button type="button" className="back" onClick={() => history.back()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
        {titre}
      </button>
      <div className="logo">Job<span>Compass</span></div>
    </div>
  )
}
