import type { OffreRow } from '@/lib/offres/types'

export default function LettreImprimable({ lettre, offre }: { lettre: string; offre: OffreRow }) {
  return (
    <div className="lettre-imprimable" data-testid="lettre-imprimable" aria-hidden="true">
      <div className="li-head">
        <b>{offre.entreprise ?? ''}</b>
        {offre.ville ? <span>{offre.ville}</span> : null}
      </div>
      <div className="li-objet">Objet : candidature au poste de {offre.titre}</div>
      <div className="li-corps">{lettre}</div>
    </div>
  )
}
