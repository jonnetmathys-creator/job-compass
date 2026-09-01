import type { OffreRow } from '@/lib/offres/types'
import { ContenuLettre, type Expediteur } from './lettre-contenu'

// Aperçu écran de la lettre, stylé comme une feuille de papier. Se met à jour en
// direct pendant l'édition (le contenu est la même structure que le PDF imprimé).
export default function ApercuLettre({
  lettre, offre, expediteur, dateFr,
}: {
  lettre: string
  offre: OffreRow
  expediteur: Expediteur
  dateFr: string
}) {
  return (
    <div className="lettre-apercu" aria-label="Aperçu de la lettre de motivation">
      <ContenuLettre lettre={lettre} offre={offre} expediteur={expediteur} dateFr={dateFr} />
    </div>
  )
}
