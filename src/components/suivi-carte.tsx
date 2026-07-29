'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { CandidatureSuivi } from '@/lib/suivi/lecture'
import { STATUTS_SUIVI, STATUT_LABEL, type StatutSuivi } from '@/lib/suivi/statuts'
import { changerStatut, enregistrerSuivi } from '@/lib/suivi/actions'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SuiviCarte({ item }: { item: CandidatureSuivi }) {
  const [statut, setStatut] = useState(item.statut)
  const [relance, setRelance] = useState(item.relance_le ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [, startTransition] = useTransition()
  const o = item.offre
  const classeStatut = `st-${statut}`

  function onStatut(v: string) {
    setStatut(v)
    startTransition(async () => {
      try { await changerStatut(o.id, v) } catch { setStatut(item.statut) }
    })
  }

  function sauverDetails(nextNotes: string, nextRelance: string) {
    startTransition(async () => {
      try {
        await enregistrerSuivi(o.id, { notes: nextNotes || null, relance_le: nextRelance || null })
      } catch { /* non bloquant */ }
    })
  }

  return (
    <div className={`suivi-carte ${classeStatut}`}>
      <div className="suivi-carte-top">
        <div className="suivi-carte-head">
          <Link href={`/offre/${o.id}`} className="suivi-carte-titre">{o.titre}</Link>
          <div className="suivi-carte-emp">
            <b>{o.entreprise ?? 'Employeur non précisé'}</b>{o.ville ? ` · ${o.ville}` : ''}
          </div>
          {item.postulee_le && <div className="suivi-carte-date">Postulée le {formatDate(item.postulee_le)}</div>}
        </div>
        <label className="suivi-carte-statut">
          <span className="sr-label">Statut</span>
          <select value={statut} onChange={(e) => onStatut(e.target.value)}>
            {STATUTS_SUIVI.map((s: StatutSuivi) => (
              <option key={s} value={s}>{STATUT_LABEL[s]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="suivi-carte-details">
        <label className="suivi-champ">
          <span>Relance prévue</span>
          <input type="date" value={relance}
            onChange={(e) => setRelance(e.target.value)}
            onBlur={(e) => sauverDetails(notes, e.target.value)} />
        </label>
        <label className="suivi-champ grow">
          <span>Notes</span>
          <textarea rows={2} value={notes} placeholder="Contact, ressenti, prochaine étape…"
            onChange={(e) => setNotes(e.target.value)}
            onBlur={(e) => sauverDetails(e.target.value, relance)} />
        </label>
      </div>
    </div>
  )
}
