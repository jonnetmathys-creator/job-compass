'use client'
import { useEffect, useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import { getBoite, compterNonVues, type NouvelleOffre } from '@/lib/alertes/boite'
import { marquerVue } from '@/lib/alertes/actions'
import { getRappels, marquerRappelVu, type RappelItem } from '@/lib/rappels/actions'
import { formatEcoule } from '@/lib/rappels/dates'
import { couleurScore } from '@/lib/scoring/palette'

export default function ClocheNotifs() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NouvelleOffre[]>([])
  const [rappels, setRappels] = useState<RappelItem[]>([])
  const [nonVues, setNonVues] = useState(0)
  const [nonVusR, setNonVusR] = useState(0)

  useEffect(() => {
    let annule = false
    const client = getBrowserClient()
    ;(async () => {
      try {
        const { data: { user } } = await client.auth.getUser()
        if (!user || annule) return
        const [b, n, r] = await Promise.all([
          getBoite(client, user.id),
          compterNonVues(client, user.id),
          getRappels(),
        ])
        if (!annule) { setItems(b); setNonVues(n); setRappels(r.items); setNonVusR(r.nonVus) }
      } catch { /* silencieux */ }
    })()
    return () => { annule = true }
  }, [])

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('#cloche')) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const total = nonVues + nonVusR

  async function consulter(offreId: string) {
    setItems((prev) => prev.map((n) => (n.offre.id === offreId ? { ...n, vue_le: 'vu' } : n)))
    setNonVues((v) => Math.max(0, v - 1))
    try { await marquerVue(offreId) } catch { /* non bloquant */ }
    window.location.href = `/offre/${offreId}`
  }

  async function consulterRappel(offreId: string, etaitNonVu: boolean) {
    setRappels((prev) => prev.map((r) => (r.offre.id === offreId ? { ...r, nonVu: false } : r)))
    if (etaitNonVu) setNonVusR((v) => Math.max(0, v - 1))
    try { await marquerRappelVu(offreId) } catch { /* non bloquant */ }
    window.location.href = `/offre/${offreId}`
  }

  const vide = items.length === 0 && rappels.length === 0

  return (
    <div className="cloche" id="cloche">
      <button className={`cloche-btn${total > 0 && !open ? ' sonne' : ''}`} data-tour="cloche" aria-label="Notifications" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {total > 0 && <span className="cloche-pastille">{total}</span>}
      </button>
      <div className={`cloche-menu${open ? ' on' : ''}`}>
        {vide && (
          <>
            <div className="cloche-head">Notifications</div>
            <div className="cloche-vide">
              Rien pour le moment.
              <small>Nouvelles offres et rappels de candidature apparaîtront ici.</small>
            </div>
          </>
        )}
        {rappels.length > 0 && (
          <>
            <div className="cloche-head">Rappels de candidature</div>
            {rappels.map((r) => (
              <button key={`r-${r.offre.id}`} type="button" className={`cloche-item rappel${r.nonVu ? ' neuf' : ''}`} onClick={() => consulterRappel(r.offre.id, r.nonVu)}>
                <span className="cloche-item-titre">{r.offre.titre}</span>
                <span className="cloche-item-emp">Consultée il y a {formatEcoule(Date.now() - Date.parse(r.consulte_le))} · souhaites-tu y postuler ?</span>
              </button>
            ))}
          </>
        )}
        {items.length > 0 && (
          <>
            <div className="cloche-head">Nouvelles offres</div>
            {items.map((n) => (
              <button key={n.offre.id} type="button" className={`cloche-item${n.vue_le ? '' : ' neuf'}${typeof n.score === 'number' && n.score >= 90 ? ' top-match' : ''}`} onClick={() => consulter(n.offre.id)}>
                <span className="cloche-item-titre">
                  {n.offre.titre}
                  {typeof n.score === 'number' && (
                    <span className="cloche-score" style={{ backgroundColor: couleurScore(n.score) }}>{n.score}%</span>
                  )}
                </span>
                {typeof n.score === 'number' && n.score >= 90
                  ? <span className="cloche-item-emp top">🎯 Correspond à {n.score}% à ton profil</span>
                  : <span className="cloche-item-emp">{n.offre.entreprise ?? 'Employeur non précisé'}{n.offre.ville ? ` · ${n.offre.ville}` : ''}</span>}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
