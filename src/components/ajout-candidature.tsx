'use client'
import { useState, useTransition } from 'react'
import { ajouterCandidatureManuelle } from '@/lib/suivi/actions'

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AjoutCandidature() {
  const [ouvert, setOuvert] = useState(false)
  const [titre, setTitre] = useState('')
  const [entreprise, setEntreprise] = useState('')
  const [ville, setVille] = useState('')
  const [url, setUrl] = useState('')
  const [dateIso, setDateIso] = useState(aujourdhui())
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) { setErreur('L\'intitulé est requis.'); return }
    setErreur(null)
    startTransition(async () => {
      try {
        await ajouterCandidatureManuelle({ titre: titre.trim(), entreprise: entreprise.trim(), ville: ville.trim(), url: url.trim(), dateIso })
        setOuvert(false); setTitre(''); setEntreprise(''); setVille(''); setUrl(''); setDateIso(aujourdhui())
      } catch {
        setErreur('Échec de l\'ajout, réessaie.')
      }
    })
  }

  if (!ouvert) {
    return (
      <button type="button" className="btn-primary ajout-ouvrir" onClick={() => setOuvert(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Ajouter une candidature
      </button>
    )
  }

  return (
    <form className="ajout-form" onSubmit={soumettre}>
      <h3>Ajouter une candidature</h3>
      <div className="ajout-grid">
        <label>Intitulé<input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Diététicien" /></label>
        <label>Entreprise<input value={entreprise} onChange={(e) => setEntreprise(e.target.value)} placeholder="Nom de l'employeur" /></label>
        <label>Ville<input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Nantes" /></label>
        <label>Lien<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></label>
        <label>Date de candidature<input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} /></label>
      </div>
      {erreur && <p className="cand-err">{erreur}</p>}
      <div className="ajout-actions">
        <button type="submit" className="btn-primary" disabled={isPending}>Ajouter</button>
        <button type="button" className="btn-ghost" onClick={() => setOuvert(false)}>Annuler</button>
      </div>
    </form>
  )
}
