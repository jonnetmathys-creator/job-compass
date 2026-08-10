'use client'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import type { OffreRow } from '@/lib/offres/types'
import { positionEpingle } from '@/lib/geo/departements'
import { toggleFavori } from '@/lib/favoris/actions'
import { marquerVue } from '@/lib/alertes/actions'
import { haptic } from '@/lib/haptics'
import PostulerZone from './postuler-zone'
import HeaderActions from './header-actions'

const PIN_SVG = '<svg width="28" height="38" viewBox="0 0 30 40" fill="currentColor"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 12.4 22.7 14.2 24.5a1.1 1.1 0 0 0 1.6 0C17.6 37.7 30 25.5 30 15 30 6.7 23.3 0 15 0Z" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="15" r="5.4" fill="#fff"/></svg>'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function OffreDetail({ offre, likedInitial, statutSuivi }: { offre: OffreRow; likedInitial: boolean; statutSuivi: string }) {
  const [liked, setLiked] = useState(likedInitial)
  const [isPending, startTransition] = useTransition()
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  const initial = (offre.entreprise?.trim()[0] ?? '?').toUpperCase()
  const position = positionEpingle(offre)

  const onToggleSave = () => {
    haptic()
    setLiked((v) => !v)
    startTransition(async () => {
      try {
        const res = await toggleFavori(offre.id)
        setLiked(res.liked)
      } catch {
        setLiked((v) => !v)
      }
    })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!position || !mapElRef.current) return
        const Lmod = await import('leaflet')
        const L = ((Lmod as any).default ?? Lmod) as typeof import('leaflet')
        if (cancelled || !mapElRef.current) return
        mapRef.current = L.map(mapElRef.current, { zoomControl: false, scrollWheelZoom: false, dragging: false })
          .setView([position.lat, position.lng], 11)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(mapRef.current)
        const icon = L.divIcon({ className: '', html: `<div class="pin">${PIN_SVG}</div>`, iconSize: [28, 38], iconAnchor: [14, 38] })
        L.marker([position.lat, position.lng], { icon }).addTo(mapRef.current)
        mapRef.current.invalidateSize()
      } catch {
        // en environnement de test (jsdom), l'API Leaflet n'est pas complètement
        // disponible : on échoue silencieusement pour ne pas casser le rendu.
      }
    })()
    return () => {
      cancelled = true
      try {
        mapRef.current?.remove()
      } catch {
        // idem : nettoyage best-effort
      }
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offre.id])

  useEffect(() => {
    marquerVue(offre.id).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offre.id])

  return (
    <section className="screen on">
      <div className="detail-top">
        <button type="button" className="back" onClick={() => history.back()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
          Retour aux résultats
        </button>
        <Link href="/" className="logo" aria-label="Retour à la recherche">Job<span>Compass</span></Link>
        <div className="spacer" />
        <HeaderActions />
      </div>
      <div className="detail-scroll">
        <div className="detail-hero">
          <header className="detail-head">
            <div className="tags">
              {offre.contrat && <span className="tag">{offre.contrat}</span>}
              {offre.salaire && <span className="tag salary">{offre.salaire}</span>}
              {offre.date_publication && <span className="tag date">{formatDate(offre.date_publication)}</span>}
            </div>
            <div className="d-titlewrap">
              <div className="d-avatar">
                {offre.entreprise_logo
                  ? (
                    <img
                      src={offre.entreprise_logo}
                      alt={offre.entreprise ?? ''}
                      onError={(e) => { (e.currentTarget.parentNode as HTMLElement).textContent = initial }}
                    />
                  )
                  : initial}
              </div>
              <div className="d-titletext">
                <h1>{offre.titre}</h1>
                <div className="d-emp">
                  <b>{offre.entreprise ?? 'Employeur non précisé'}</b>{offre.ville ? ` · ${offre.ville}` : ''}
                </div>
              </div>
            </div>
          </header>
        </div>
        <div className="detail-wrap">
          <div className="detail-grid">
            <div className="detail-main">
              <section className="d-block">
                <h4>Description du poste</h4>
                <p>{offre.description ?? 'Aucune description fournie.'}</p>
              </section>
            </div>
            <aside className="detail-side">
              <div className="side-card">
                <div className="side-row">
                  <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>Contrat</span>
                  <b>{offre.contrat ?? 'Non précisé'}</b>
                </div>
                <div className="side-row">
                  <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>Lieu</span>
                  <b>{offre.ville ?? 'Non précisé'}</b>
                </div>
                <div className="side-row">
                  <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12" /><path d="M4 14h9" /><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7 7 0 0 0 7 12a7 7 0 0 0 6.8 8 7.7 7.7 0 0 0 5.2-2" /></svg>Salaire</span>
                  <b className="hl">{offre.salaire ?? 'Non précisé'}</b>
                </div>
                <div className="side-row">
                  <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>Publiée</span>
                  <b>{offre.date_publication ? formatDate(offre.date_publication) : 'Non précisée'}</b>
                </div>
              </div>
              {position && <div ref={mapElRef} className="side-map" />}
              <button type="button" className={`btn-save${liked ? ' on' : ''}`} onClick={onToggleSave} disabled={isPending} aria-pressed={liked}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
                Sauvegarder l'offre
              </button>
              <PostulerZone offreId={offre.id} statutInitial={statutSuivi} label="Postuler" href={offre.url_postuler} />
              <Link href={`/offre/${offre.id}/candidature`} className="btn-ia" data-tour="candidature-ia">
                Candidater avec lettre IA
              </Link>
            </aside>
          </div>
        </div>
      </div>
    </section>
  )
}
