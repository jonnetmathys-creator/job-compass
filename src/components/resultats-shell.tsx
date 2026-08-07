'use client'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { OffreAffichee } from '@/lib/offres/dedup-affichage'

type OffreScoree = OffreAffichee & { score?: number; raison?: string | null }
import OffreListe from './offre-liste'
import FiltresBarClient from './filtres-bar'
import { toggleFavori } from '@/lib/favoris/actions'

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
          <button type="button" className={`tri-pertinence${triPertinence ? ' on' : ''}`}
            aria-pressed={triPertinence} onClick={() => setTriPertinence((v) => !v)}>
            Trier par pertinence
          </button>
        )}
      </div>
      <div className={`split vue-${vue}${collapsed ? ' collapsed' : ''}`} id="split">
        <div className="list-pane" id="list" data-tour="liste">
          <OffreListe offres={visibles} expandedId={expandedId} hoveredId={hoveredId} likes={likes}
            onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
            onHover={setHoveredId} onToggleLike={onToggleLike} />
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
