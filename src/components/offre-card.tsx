'use client'
import LikeBouton from './like-bouton'
import type { OffreRow } from '@/lib/offres/types'

export default function OffreCard(props: {
  offre: OffreRow; expanded: boolean; liked: boolean; hovered: boolean
  onToggleExpand: () => void; onOpen: () => void; onToggleLike: () => void; onHover: (h: boolean) => void
}) {
  const { offre } = props
  return (
    <div className={`card${props.expanded ? ' expanded' : ''}${props.hovered ? ' active' : ''}`}
      data-offre-id={offre.id}
      onMouseEnter={() => props.onHover(true)} onMouseLeave={() => props.onHover(false)}
      onClick={(e) => { if ((e.target as HTMLElement).closest('.preview')) return; props.onToggleExpand() }}>
      <LikeBouton liked={props.liked} onToggle={props.onToggleLike} dataTour="like" />
      <h3>{offre.titre}</h3>
      <div className="emp"><b>{offre.entreprise ?? 'Employeur non précisé'}</b>{offre.ville ? ` · ${offre.ville}` : ''}</div>
      <div className="tags">
        {offre.contrat && <span className="tag">{offre.contrat}</span>}
        {offre.salaire && <span className="tag salary">{offre.salaire}</span>}
        {offre.date_publication && <span className="tag date">{formatDate(offre.date_publication)}</span>}
      </div>
      <div className="preview">
        {offre.description && <p>{offre.description}</p>}
        <button className="btn-more" onClick={(e) => { e.stopPropagation(); props.onOpen() }}>En savoir plus
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
