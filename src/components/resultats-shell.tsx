'use client'
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { OffreRow } from '@/lib/offres/types'
import OffreListe from './offre-liste'
import FiltresBarClient from './filtres-bar'
import { toggleFavori } from '@/lib/favoris/actions'

const CarteOffres = dynamic(() => import('./carte-offres'), { ssr: false })

export default function ResultatsShell(props: {
  recherche: {
    id: string; intitule: string; localisation: string | null; rayon_km: number | null
    lieu_label: string | null
  }
  offres: OffreRow[]
  favoriIds: string[]
}) {
  const [contrat, setContrat] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [likes, setLikes] = useState<Set<string>>(new Set(props.favoriIds))

  const contrats = useMemo(
    () => Array.from(new Set(props.offres.map((o) => o.contrat).filter(Boolean))) as string[],
    [props.offres],
  )
  const visibles = useMemo(
    () => (contrat ? props.offres.filter((o) => o.contrat === contrat) : props.offres),
    [props.offres, contrat],
  )

  const onToggleLike = async (id: string) => {
    setLikes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    try { await toggleFavori(id) } catch { setLikes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <FiltresBarClient poste={props.recherche.intitule} contrats={contrats} contrat={contrat} onContrat={setContrat} rechercheId={props.recherche.id}
        initialLieu={props.recherche.lieu_label ?? ''} initialRayon={props.recherche.rayon_km} />
      <div className={`split${collapsed ? ' collapsed' : ''}`} id="split">
        <div className="list-pane" id="list">
          <OffreListe offres={visibles} expandedId={expandedId} hoveredId={hoveredId} likes={likes}
            onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
            onHover={setHoveredId} onToggleLike={onToggleLike} />
        </div>
        <div className="map-pane">
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
