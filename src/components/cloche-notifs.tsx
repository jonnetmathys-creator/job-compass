'use client'
import { useEffect, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import { getBoite, compterNonVues, type NouvelleOffre } from '@/lib/alertes/boite'
import { marquerVue } from '@/lib/alertes/actions'

export default function ClocheNotifs() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NouvelleOffre[]>([])
  const [nonVues, setNonVues] = useState(0)

  useEffect(() => {
    let annule = false
    const client = getBrowserClient()
    ;(async () => {
      try {
        const { data: { user } } = await client.auth.getUser()
        if (!user || annule) return
        const [b, n] = await Promise.all([getBoite(client, user.id), compterNonVues(client, user.id)])
        if (!annule) { setItems(b); setNonVues(n) }
      } catch { /* silencieux */ }
    })()
    return () => { annule = true }
  }, [])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('#cloche')) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  async function consulter(offreId: string) {
    setItems((prev) => prev.map((n) => (n.offre.id === offreId ? { ...n, vue_le: 'vu' } : n)))
    setNonVues((v) => Math.max(0, v - 1))
    try { await marquerVue(offreId) } catch { /* non bloquant */ }
    window.location.href = `/offre/${offreId}`
  }

  return (
    <div className="cloche" id="cloche">
      <button className="cloche-btn" aria-label="Nouvelles offres" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {nonVues > 0 && <span className="cloche-pastille">{nonVues}</span>}
      </button>
      <div className={`cloche-menu${open ? ' on' : ''}`}>
        <div className="cloche-head">Nouvelles offres</div>
        {items.length === 0
          ? (
            <div className="cloche-vide">
              Aucune nouvelle offre.
              <small>Les nouvelles offres de tes recherches apparaîtront ici.</small>
            </div>
          )
          : items.map((n) => (
            <button key={n.offre.id} type="button" className={`cloche-item${n.vue_le ? '' : ' neuf'}`} onClick={() => consulter(n.offre.id)}>
              <span className="cloche-item-titre">{n.offre.titre}</span>
              <span className="cloche-item-emp">{n.offre.entreprise ?? 'Employeur non précisé'}{n.offre.ville ? ` · ${n.offre.ville}` : ''}</span>
            </button>
          ))}
      </div>
    </div>
  )
}
