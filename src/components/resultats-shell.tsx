'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { OffreAffichee } from '@/lib/offres/dedup-affichage'

type OffreScoree = OffreAffichee & { score?: number; raison?: string | null }
import OffreListe from './offre-liste'
import FiltresBarClient from './filtres-bar'
import { toggleFavori } from '@/lib/favoris/actions'
import { rafraichirOffres } from '@/lib/recherche/actions'

const PTR_SEUIL = 60 // px de tirage pour déclencher le rafraîchissement

const CarteOffres = dynamic(() => import('./carte-offres'), { ssr: false })

export default function ResultatsShell(props: {
  recherche: {
    id: string; intitule: string; localisation: string | null; rayon_km: number | null
    lieu_label: string | null; alertes_email?: boolean
  }
  offres: OffreScoree[]
  favoriIds: string[]
}) {
  const [contrat, setContrat] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [vue, setVue] = useState<'liste' | 'carte'>('liste')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [likes, setLikes] = useState<Set<string>>(new Set(props.favoriIds))
  const [triPertinence, setTriPertinence] = useState(false)
  const router = useRouter()
  const paneRef = useRef<HTMLDivElement>(null)
  const tirage = useRef({ startY: 0, actif: false })
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const contrats = useMemo(
    () => Array.from(new Set(props.offres.map((o) => o.contrat).filter(Boolean))) as string[],
    [props.offres],
  )
  const visibles = useMemo(() => {
    const filtrees = contrat ? props.offres.filter((o) => o.contrat === contrat) : props.offres
    if (!triPertinence) return filtrees
    // Tri par pertinence : score décroissant, offres sans score en fin.
    return [...filtrees].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  }, [props.offres, contrat, triPertinence])

  // Quand on bascule sur la carte (mobile), Leaflet doit recalculer sa taille.
  useEffect(() => {
    if (vue !== 'carte') return
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
    return () => clearTimeout(t)
  }, [vue])

  // La visite guidée pilote la vue (elle a besoin de la carte à l'étape « carte »).
  useEffect(() => {
    const h = (e: Event) => {
      const v = (e as CustomEvent).detail
      if (v === 'liste' || v === 'carte') setVue(v)
    }
    window.addEventListener('jc-tour-vue', h)
    return () => window.removeEventListener('jc-tour-vue', h)
  }, [])

  const onToggleLike = async (id: string) => {
    setLikes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    try { await toggleFavori(id) } catch { setLikes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  }

  // Pull-to-refresh (mobile) : on ne l'arme qu'en vue liste, en haut du scroll.
  // overscroll-behavior:none empêche déjà le rebond blanc ; on ne translate que le contenu.
  function ptrStart(e: React.TouchEvent) {
    const pane = paneRef.current
    if (!pane || refreshing || vue !== 'liste' || pane.scrollTop > 0) return
    tirage.current = { startY: e.touches[0].clientY, actif: true }
    setDragging(true)
  }
  function ptrMove(e: React.TouchEvent) {
    if (!tirage.current.actif) return
    const pane = paneRef.current!
    const dy = e.touches[0].clientY - tirage.current.startY
    if (dy > 0 && pane.scrollTop <= 0) setPull(Math.min(dy * 0.5, 80))
    else { tirage.current.actif = false; setDragging(false); setPull(0) }
  }
  async function ptrEnd() {
    if (!tirage.current.actif) return
    tirage.current.actif = false
    setDragging(false)
    if (pull >= PTR_SEUIL && !refreshing) {
      setRefreshing(true); setPull(46)
      try { await rafraichirOffres(props.recherche.id); router.refresh() }
      catch { /* non bloquant */ }
      setRefreshing(false)
    }
    setPull(0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <FiltresBarClient poste={props.recherche.intitule} contrats={contrats} contrat={contrat} onContrat={setContrat} rechercheId={props.recherche.id}
        initialLieu={props.recherche.lieu_label ?? ''} initialRayon={props.recherche.rayon_km} alertesEmail={props.recherche.alertes_email ?? false} />
      <div className="barre-affichage">
        <div className="segment-vue" role="tablist" aria-label="Affichage des résultats">
          <button type="button" role="tab" aria-selected={vue === 'liste'} className={vue === 'liste' ? 'on' : ''} onClick={() => setVue('liste')}>Liste</button>
          <button type="button" role="tab" aria-selected={vue === 'carte'} className={vue === 'carte' ? 'on' : ''} onClick={() => setVue('carte')}>Carte</button>
        </div>
        {props.offres.some((o) => typeof o.score === 'number') && (
          <div className="tri-segment" role="group" aria-label="Tri des offres">
            <span className="tri-label">Trier par</span>
            <div className="tri-toggle">
              <button type="button" className={!triPertinence ? 'on' : ''} aria-pressed={!triPertinence} onClick={() => setTriPertinence(false)}>Date</button>
              <button type="button" className={triPertinence ? 'on' : ''} aria-pressed={triPertinence} onClick={() => setTriPertinence(true)}>Pertinence</button>
            </div>
          </div>
        )}
      </div>
      <div className={`split vue-${vue}${collapsed ? ' collapsed' : ''}`} id="split">
        <div className="list-pane" id="list" data-tour="liste" ref={paneRef}
          onTouchStart={ptrStart} onTouchMove={ptrMove} onTouchEnd={ptrEnd}>
          <div className={`ptr${refreshing ? ' spin' : ''}`} style={{ opacity: Math.min(pull / PTR_SEUIL, 1), transform: `translateY(${Math.max(0, pull - 34)}px) rotate(${pull * 3}deg)` }} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg>
          </div>
          <div style={{ transform: `translateY(${pull}px)`, transition: dragging ? 'none' : 'transform .3s ease' }}>
            <OffreListe offres={visibles} expandedId={expandedId} hoveredId={hoveredId} likes={likes}
              onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
              onHover={setHoveredId} onToggleLike={onToggleLike} />
          </div>
        </div>
        <div className="map-pane" data-tour="carte">
          <button className="map-toggle" aria-label="Replier ou déplier la liste" onClick={() => setCollapsed((c) => !c)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <CarteOffres offres={visibles} hoveredId={hoveredId} expandedId={expandedId}
            onHover={setHoveredId} onSelect={(id) => { setExpandedId(id); setCollapsed(false) }} />
        </div>
      </div>
    </div>
  )
}
