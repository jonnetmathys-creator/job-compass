'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RechercheResume } from '@/lib/recherche/liste'
import SearchBar from './search-bar'
import HeaderActions from './header-actions'
import RechercheCarte from './recherche-carte'

// Molette cumulée (px) nécessaire pour ouvrir le tiroir « à la résistance ».
const SEUIL_WHEEL = 1050

export default function AccueilClient({ recherches }: { recherches: RechercheResume[] }) {
  const aDesRecherches = recherches.length > 0
  const [ouvert, setOuvert] = useState(false)
  const [charge, setCharge] = useState(0) // 0..1, remplissage de la jauge à la résistance
  const drawerRef = useRef<HTMLDivElement>(null)
  const ouvertRef = useRef(false)
  const chargeRef = useRef(0)
  const reduceRef = useRef(false)

  const poserCharge = useCallback((v: number) => {
    const c = Math.max(0, Math.min(1, v))
    chargeRef.current = c
    setCharge(c)
    return c
  }, [])

  const scrollVersListe = useCallback(() => {
    const el = drawerRef.current
    if (!el) return
    // Cible absolue (haut du tiroir), figée avant l'animation. Comme le tiroir
    // s'ouvre depuis une hauteur ~0, on ne peut pas faire un scrollTo ponctuel
    // (la page n'est pas encore assez haute -> plafonné). On anime donc le scroll
    // sur la durée de l'ouverture : la page grandit, le défilement la suit.
    const cible = el.getBoundingClientRect().top + window.scrollY - 10
    if (reduceRef.current) { window.scrollTo(0, cible); return }
    const y0 = window.scrollY
    const t0 = performance.now()
    const duree = 560
    const pas = (t: number) => {
      const p = Math.min(1, (t - t0) / duree)
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2 // easeInOutQuad
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo(0, Math.min(y0 + (cible - y0) * e, max))
      if (p < 1) requestAnimationFrame(pas)
    }
    requestAnimationFrame(pas)
  }, [])

  const ouvrir = useCallback(() => {
    ouvertRef.current = true
    setOuvert(true)
    poserCharge(0)
    scrollVersListe()
  }, [poserCharge, scrollVersListe])

  const fermer = useCallback(() => {
    ouvertRef.current = false
    setOuvert(false)
    poserCharge(0)
    window.scrollTo({ top: 0, behavior: reduceRef.current ? 'auto' : 'smooth' })
  }, [poserCharge])

  const basculer = useCallback(() => { if (ouvertRef.current) fermer(); else ouvrir() }, [fermer, ouvrir])

  // Résistance au scroll : tant que le tiroir est fermé et qu'on est en haut, la
  // molette / le glissement remplit la jauge au lieu de faire défiler la page ;
  // pleine, elle ouvre. Au repos, la jauge redescend (effet ressort).
  useEffect(() => {
    if (!aDesRecherches) return
    reduceRef.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduceRef.current) return // pas de charge animée : le clic suffit

    let dernierMouv = 0
    let touchY: number | null = null

    const actif = () => !ouvertRef.current && window.scrollY <= 2

    const onWheel = (e: WheelEvent) => {
      if (!actif()) return
      if (e.deltaY > 0) {
        e.preventDefault()
        dernierMouv = Date.now()
        if (poserCharge(chargeRef.current + e.deltaY / SEUIL_WHEEL) >= 1) ouvrir()
      } else if (e.deltaY < 0 && chargeRef.current > 0) {
        e.preventDefault()
        dernierMouv = Date.now()
        poserCharge(chargeRef.current + e.deltaY / SEUIL_WHEEL)
      }
    }
    const onTouchStart = (e: TouchEvent) => { touchY = actif() ? e.touches[0].clientY : null }
    const onTouchMove = (e: TouchEvent) => {
      if (touchY == null || !actif()) return
      const dy = touchY - e.touches[0].clientY
      if (dy > 0) {
        e.preventDefault()
        touchY = e.touches[0].clientY
        dernierMouv = Date.now()
        if (poserCharge(chargeRef.current + dy / (SEUIL_WHEEL * 0.7)) >= 1) ouvrir()
      }
    }
    const onTouchEnd = () => { touchY = null }

    const decroit = window.setInterval(() => {
      if (ouvertRef.current || chargeRef.current <= 0) return
      if (Date.now() - dernierMouv < 130) return
      poserCharge(chargeRef.current - 0.08)
    }, 28)

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.clearInterval(decroit)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [aDesRecherches, ouvrir, poserCharge])

  // Anneau de progression autour du chevron (r=11 -> circonférence ~69).
  const C = 69.1
  const nbAlertes = recherches.filter((r) => r.alertes_email).length

  return (
    <main className="home-main">
      <div className="decor" aria-hidden>
          <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
          <div className="ring r1" /><div className="ring r2" />
          <svg className="compass" width="150" height="150" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="50" cy="50" r="46" /><circle cx="50" cy="50" r="34" />
            <polygon points="50,20 58,50 50,80 42,50" fill="currentColor" stroke="none" opacity=".7" />
            <circle cx="50" cy="50" r="3" fill="currentColor" stroke="none" />
          </svg>
          <svg className="dotgrid" width="120" height="120" viewBox="0 0 120 120" fill="currentColor">
            <circle cx="10" cy="10" r="2" /><circle cx="40" cy="10" r="2" /><circle cx="70" cy="10" r="2" /><circle cx="100" cy="10" r="2" />
            <circle cx="10" cy="40" r="2" /><circle cx="40" cy="40" r="2" /><circle cx="70" cy="40" r="2" /><circle cx="100" cy="40" r="2" />
            <circle cx="10" cy="70" r="2" /><circle cx="40" cy="70" r="2" /><circle cx="70" cy="70" r="2" /><circle cx="100" cy="70" r="2" />
            <circle cx="10" cy="100" r="2" /><circle cx="40" cy="100" r="2" /><circle cx="70" cy="100" r="2" /><circle cx="100" cy="100" r="2" />
          </svg>
      </div>
      <section className="home-hero">
        <div className="home-actions"><HeaderActions /></div>

        <SearchBar />

        {aDesRecherches && (
          <button type="button" className={`acc-poignee${ouvert ? ' ouvert' : ''}`} onClick={basculer}
            aria-expanded={ouvert} aria-controls="acc-drawer"
            aria-label={ouvert ? 'Replier mes recherches' : 'Dérouler mes recherches'}>
            <span className="acc-poignee-txt">Mes recherches</span>
            <span className="acc-poignee-nb">{recherches.length}</span>
            <span className="acc-poignee-rond">
              <svg className="acc-poignee-jauge" width="26" height="26" viewBox="0 0 26 26" aria-hidden>
                <circle cx="13" cy="13" r="11" fill="none" stroke="#e2e6e2" strokeWidth="2" />
                <circle cx="13" cy="13" r="11" fill="none" stroke="#2e9e5b" strokeWidth="2" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - charge)} transform="rotate(-90 13 13)" />
              </svg>
              <svg className="acc-poignee-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </span>
          </button>
        )}
      </section>

      {aDesRecherches && (
        <div id="acc-drawer" ref={drawerRef} className={`acc-drawer${ouvert ? ' open' : ''}`} aria-hidden={!ouvert}>
          <div className="acc-drawer-inner">
            <div className="acc-drawer-wrap">
              <div className="acc-drawer-head">
                <h2>Mes recherches</h2>
                <span className="acc-drawer-sub">{recherches.length} · {nbAlertes} alerte{nbAlertes > 1 ? 's' : ''} active{nbAlertes > 1 ? 's' : ''}</span>
                <span className="rech-spacer" />
                <button type="button" className="acc-drawer-reduire" onClick={fermer} aria-label="Replier">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                </button>
              </div>
              <div className="rech-grid">
                {recherches.map((r) => <RechercheCarte key={r.id} recherche={r} />)}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
