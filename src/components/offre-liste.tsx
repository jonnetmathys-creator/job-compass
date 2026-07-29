'use client'
import OffreCard from './offre-card'
import type { OffreRow } from '@/lib/offres/types'

export default function OffreListe(props: {
  offres: OffreRow[]; expandedId: string | null; hoveredId: string | null; likes: Set<string>
  onToggleExpand: (id: string) => void; onHover: (id: string | null) => void; onToggleLike: (id: string) => void
}) {
  if (props.offres.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>Aucune offre pour cette recherche.</p>
        <p style={{ fontSize: 14 }}>Élargissez le lieu ou le rayon pour trouver plus d&apos;offres.</p>
      </div>
    )
  }
  return (
    <>
      {props.offres.map((o) => (
        <OffreCard key={o.id} offre={o}
          expanded={props.expandedId === o.id} liked={props.likes.has(o.id)} hovered={props.hoveredId === o.id}
          onToggleExpand={() => props.onToggleExpand(o.id)} onOpen={() => { window.location.href = `/offre/${o.id}` }}
          onToggleLike={() => props.onToggleLike(o.id)} onHover={(h) => props.onHover(h ? o.id : null)} />
      ))}
    </>
  )
}
