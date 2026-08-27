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
import OffreDescription from './offre-description'

const PIN_SVG = '<svg width="28" height="38" viewBox="0 0 30 40" fill="currentColor"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 12.4 22.7 14.2 24.5a1.1 1.1 0 0 0 1.6 0C17.6 37.7 30 25.5 30 15 30 6.7 23.3 0 15 0Z" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="15" r="5.4" fill="#fff"/></svg>'

export default function OffreDetail({ offre, likedInitial, statutSuivi, anon = false }: { offre: OffreRow; likedInitial: boolean; statutSuivi: string; anon?: boolean }) {
  const [liked, setLiked] = useState(likedInitial)
  const [partageCopie, setPartageCopie] = useState(false)
  const [isPending, startTransition] = useTransition()
  const mapElRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  const initial = (offre.entreprise?.trim()[0] ?? '?').toUpperCase()
  const position = positionEpingle(offre)

  // Partage natif (feuille de partage du téléphone / OS). Repli desktop : copie du lien.
  const partager = async () => {
    haptic()
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const chez = offre.entreprise ? ` chez ${offre.entreprise}` : ''
    const lieu = offre.ville ? ` (${offre.ville})` : ''
    const texte = `J'ai trouvé un poste sur JobCompass qui pourrait te convenir : ${offre.titre}${chez}${lieu}. Jette un œil 👇`
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (typeof nav.share === 'function') {
      try { await nav.share({ title: `${offre.titre} · JobCompass`, text: texte, url }) } catch { /* annulé */ }
      return
    }
    try {
      await navigator.clipboard.writeText(`${texte}\n${url}`)
      setPartageCopie(true)
      setTimeout(() => setPartageCopie(false), 2200)
    } catch { /* ignore */ }
  }

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
        // Fond gris clair minimal (Esri Light Gray), sans clé : fond + libellés.
        const esriOpts = { maxZoom: 20, maxNativeZoom: 16 }
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', esriOpts).addTo(mapRef.current)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', esriOpts).addTo(mapRef.current)
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
    if (anon) return // visiteur non connecté : pas de suivi « vu »
    marquerVue(offre.id).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offre.id])

  return (
    <section className="screen on">
      <div className="detail-top">
        {!anon && (
          <button type="button" className="back" onClick={() => history.back()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
            Retour aux résultats
          </button>
        )}
        <Link href="/" className="logo" aria-label="Accueil JobCompass">Job<span>Compass</span></Link>
        <div className="spacer" />
        {anon ? <Link href="/login" className="btn-login-sm">Se connecter</Link> : <HeaderActions />}
      </div>
      <div className="detail-scroll">
        <div className="detail-hero">
          <header className="detail-head">
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
              <button type="button" className="d-share" onClick={partager} aria-label="Partager cette offre">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" />
                </svg>
                {partageCopie && <span className="d-share-toast">Lien copié</span>}
              </button>
            </div>
          </header>
        </div>
        <div className="detail-wrap">
          <div className="detail-grid">
            <div className="detail-main">
              <OffreDescription offre={offre} />
            </div>
            <aside className="detail-side">
              {position && <div ref={mapElRef} className="side-map" />}
              {anon
                ? (
                  <>
                    {offre.url_postuler && (
                      <a className="btn-apply" href={offre.url_postuler} target="_blank" rel="noopener">
                        Postuler
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
                      </a>
                    )}
                    <div className="anon-invite">
                      <b>Postulez plus vite avec JobCompass</b>
                      <p>Créez un compte gratuit pour sauvegarder cette offre, suivre vos candidatures et générer votre lettre de motivation par IA.</p>
                      <Link href="/signup" className="btn-ia anon-cta">Créer un compte gratuit</Link>
                      <Link href="/login" className="anon-login">J'ai déjà un compte</Link>
                    </div>
                  </>
                )
                : (
                  <>
                    <button type="button" className={`btn-save${liked ? ' on' : ''}`} onClick={onToggleSave} disabled={isPending} aria-pressed={liked}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
                      Sauvegarder l'offre
                    </button>
                    <PostulerZone offreId={offre.id} statutInitial={statutSuivi} label="Postuler" href={offre.url_postuler} />
                    <Link href={`/offre/${offre.id}/candidature`} className="btn-ia" data-tour="candidature-ia">
                      Candidater avec lettre IA
                    </Link>
                  </>
                )}
            </aside>
          </div>
        </div>
      </div>
    </section>
  )
}
