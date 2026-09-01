import type { OffreRow } from '@/lib/offres/types'

export type Expediteur = {
  nom: string
  adresse: string
  codePostal: string
  ville: string
  telephone: string
  email: string
}

// Structure d'une vraie lettre : expéditeur haut-gauche, destinataire haut-droite,
// lieu + date, objet, corps justifié. Partagée entre l'aperçu écran (ApercuLettre)
// et la version imprimée (LettreImprimable) pour rester cohérentes.
export function ContenuLettre({
  lettre, offre, expediteur, dateFr,
}: {
  lettre: string
  offre: OffreRow
  expediteur: Expediteur
  dateFr: string
}) {
  const cpVille = [expediteur.codePostal, expediteur.ville].filter(Boolean).join(' ')
  const lieuDate = expediteur.ville ? `À ${expediteur.ville}, le ${dateFr}` : `Le ${dateFr}`

  return (
    <>
      <div className="li-top">
        <div className="li-exp">
          {expediteur.nom ? <b>{expediteur.nom}</b> : null}
          {expediteur.adresse ? <span>{expediteur.adresse}</span> : null}
          {cpVille ? <span>{cpVille}</span> : null}
          {expediteur.telephone ? <span>{expediteur.telephone}</span> : null}
          {expediteur.email ? <span>{expediteur.email}</span> : null}
        </div>
        <div className="li-dest">
          {offre.entreprise ? <b>{offre.entreprise}</b> : null}
          {offre.ville ? <span>{offre.ville}</span> : null}
        </div>
      </div>

      <div className="li-date">{lieuDate}</div>
      <div className="li-objet">Objet : candidature au poste de {offre.titre}</div>
      <div className="li-corps">{lettre || <span className="li-vide">Ta lettre apparaîtra ici…</span>}</div>
    </>
  )
}
