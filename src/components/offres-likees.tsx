import type { OffreRow } from '@/lib/offres/types'

export default function OffresLikees({ offres }: { offres: OffreRow[] }) {
  if (offres.length === 0) {
    return (
      <div className="liked-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
        <div>Aucune offre likée pour l&apos;instant.<br />Cliquez le cœur sur une offre pour la retrouver ici.</div>
      </div>
    )
  }
  return (
    <div className="liked-list">
      {offres.map((o) => (
        <a key={o.id} className="card" href={`/offre/${o.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <h3>{o.titre}</h3>
          <div className="emp"><b>{o.entreprise ?? 'Employeur non précisé'}</b>{o.ville ? ` · ${o.ville}` : ''}</div>
          <div className="tags">
            {o.contrat && <span className="tag">{o.contrat}</span>}
            {o.salaire && <span className="tag salary">{o.salaire}</span>}
          </div>
        </a>
      ))}
    </div>
  )
}
