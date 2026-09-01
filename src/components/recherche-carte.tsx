'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RechercheResume } from '@/lib/recherche/liste'
import { basculerAlertesEmail } from '@/lib/alertes/actions'
import { supprimerRecherche } from '@/lib/recherche/actions'
import { haptic } from '@/lib/haptics'

function fraicheur(iso: string | null): string {
  if (!iso) return 'jamais collectée'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'à l’instant'
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  if (j === 1) return 'hier'
  return `il y a ${j} j`
}

function lieu(r: RechercheResume): string {
  if (!r.lieu_label) return 'France entière'
  return r.rayon_km ? `${r.lieu_label} · ${r.rayon_km} km` : r.lieu_label
}

export default function RechercheCarte({ recherche }: { recherche: RechercheResume }) {
  const router = useRouter()
  const [alerte, setAlerte] = useState(recherche.alertes_email)
  const [retiree, setRetiree] = useState(false)
  const [, startTransition] = useTransition()

  if (retiree) return null

  function ouvrir() {
    haptic()
    router.push(`/recherche/${recherche.id}`)
  }

  function toggleAlerte(e: React.MouseEvent) {
    e.stopPropagation()
    haptic()
    const cible = !alerte
    setAlerte(cible)
    startTransition(async () => {
      try { const r = await basculerAlertesEmail(recherche.id); setAlerte(r.actif) } catch { setAlerte(!cible) }
    })
  }

  function supprimer(e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Supprimer la recherche « ${recherche.intitule} » ?`)) return
    haptic()
    setRetiree(true)
    startTransition(async () => {
      try { await supprimerRecherche(recherche.id) } catch { setRetiree(false) }
    })
  }

  return (
    <div className="rech-carte" role="button" tabIndex={0} onClick={ouvrir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir() } }}>
      <div className="rech-carte-haut">
        <div className="rech-carte-tete">
          <span className="rech-carte-titre">{recherche.intitule}</span>
          <div className="rech-tags">
            <span className="rech-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              {lieu(recherche)}
            </span>
            {recherche.type_contrat && <span className="rech-tag contrat">{recherche.type_contrat}</span>}
          </div>
        </div>
        <button type="button" className={`rech-alerte${alerte ? ' on' : ''}`} onClick={toggleAlerte}
          aria-pressed={alerte} aria-label={alerte ? 'Désactiver l’alerte email' : 'Activer l’alerte email'}>
          {alerte
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /><path d="m2 2 20 20" /></svg>}
          Alerte
        </button>
      </div>
      <div className="rech-carte-sep" />
      <div className="rech-carte-bas">
        <span className="rech-nb">{recherche.nb_offres} offre{recherche.nb_offres > 1 ? 's' : ''}</span>
        <span className="rech-fraich">· {fraicheur(recherche.derniere_collecte)}</span>
        <span className="rech-spacer" />
        <button type="button" className="rech-suppr" onClick={supprimer} aria-label="Supprimer la recherche">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
        </button>
        <svg className="rech-chevron" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </div>
    </div>
  )
}
