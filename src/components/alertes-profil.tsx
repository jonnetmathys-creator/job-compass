'use client'
import { useState, useTransition } from 'react'
import { supprimerAlerte } from '@/lib/alertes/actions'
import type { Alerte } from '@/lib/alertes/liste'

export default function AlertesProfil({ alertes }: { alertes: Alerte[] }) {
  const [items, setItems] = useState<Alerte[]>(alertes)
  const [isPending, startTransition] = useTransition()

  function retirer(id: string) {
    const avant = items
    setItems((prev) => prev.filter((a) => a.id !== id))
    startTransition(async () => {
      try { await supprimerAlerte(id) } catch { setItems(avant) }
    })
  }

  return (
    <div className="alertes-profil">
      <div className="alertes-profil-head">
        <span className="alertes-profil-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        </span>
        <div className="alertes-profil-txt">
          <b>Mes alertes mail</b>
          <small>Reçois les nouvelles offres par email pour ces recherches</small>
        </div>
      </div>
      {items.length === 0
        ? <p className="alertes-profil-vide">Aucune alerte active. Active « Alertes mail » sur une page de résultats.</p>
        : (
          <ul className="alertes-profil-liste">
            {items.map((a) => (
              <li key={a.id} className="alertes-profil-item">
                <span className="alertes-profil-nom">
                  {a.intitule}
                  {a.lieu_label && <em> · {a.lieu_label}</em>}
                </span>
                <button type="button" className="alertes-profil-del" onClick={() => retirer(a.id)} disabled={isPending} aria-label={`Supprimer l'alerte ${a.intitule}`}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></svg>
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
