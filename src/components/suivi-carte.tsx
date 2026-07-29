'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { CandidatureSuivi } from '@/lib/suivi/lecture'
import { STATUTS_SUIVI, STATUT_LABEL, type StatutSuivi } from '@/lib/suivi/statuts'
import { changerStatut, enregistrerSuivi, genererRelance, enregistrerRelance, supprimerCandidature } from '@/lib/suivi/actions'
import { joursDepuis, estARelancer } from '@/lib/suivi/dates'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function SuiviCarte({ item, today }: { item: CandidatureSuivi; today: string }) {
  const [statut, setStatut] = useState(item.statut)
  const [relance, setRelance] = useState(item.relance_le ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [relObjet, setRelObjet] = useState(item.relance_objet ?? '')
  const [relCorps, setRelCorps] = useState(item.relance_corps ?? '')
  const [relanceOuverte, setRelanceOuverte] = useState(Boolean(item.relance_corps))
  const [info, setInfo] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const o = item.offre
  const aRelancer = estARelancer(statut, relance || null, today)
  const jours = item.postulee_le ? joursDepuis(item.postulee_le, today) : null

  function onStatut(v: string) {
    setStatut(v)
    startTransition(async () => { try { await changerStatut(o.id, v) } catch { setStatut(item.statut) } })
  }
  function sauverDetails(nextNotes: string, nextRelance: string) {
    startTransition(async () => { try { await enregistrerSuivi(o.id, { notes: nextNotes || null, relance_le: nextRelance || null }) } catch { /* non bloquant */ } })
  }
  function genererMailRelance() {
    setErreur(null); setInfo(null)
    startTransition(async () => {
      try {
        const c = await genererRelance(o.id)
        setRelObjet(c.objet); setRelCorps(c.corps); setRelanceOuverte(true)
      } catch { setErreur('La génération a échoué, réessaie.') }
    })
  }
  function sauverRelance() {
    startTransition(async () => { try { await enregistrerRelance(o.id, { objet: relObjet, corps: relCorps }); setInfo('Relance enregistrée ✓') } catch { setErreur('Échec, réessaie.') } })
  }
  async function copierRelance() {
    try { await navigator.clipboard.writeText(`${relObjet}\n\n${relCorps}`); setInfo('Mail de relance copié ✓') } catch { setErreur('Copie impossible.') }
  }
  function supprimer() {
    if (!window.confirm('Supprimer cette candidature du suivi ?')) return
    startTransition(async () => { try { await supprimerCandidature(o.id) } catch { setErreur('Échec de la suppression, réessaie.') } })
  }

  const titre = o.source === 'manuelle'
    ? (o.url_postuler
        ? <a href={o.url_postuler} target="_blank" rel="noopener" className="suivi-carte-titre">{o.titre}</a>
        : <span className="suivi-carte-titre">{o.titre}</span>)
    : <Link href={`/offre/${o.id}`} className="suivi-carte-titre">{o.titre}</Link>

  return (
    <div className={`suivi-carte st-${statut}`}>
      <div className="suivi-carte-top">
        <div className="suivi-carte-head">
          {titre}
          <div className="suivi-carte-emp"><b>{o.entreprise ?? 'Employeur non précisé'}</b>{o.ville ? ` · ${o.ville}` : ''}</div>
          <div className="suivi-carte-meta">
            {jours !== null && <span>Postulé il y a {jours} jour{jours > 1 ? 's' : ''}</span>}
            {aRelancer && <span className="suivi-badge-relance">À relancer</span>}
          </div>
        </div>
        <div className="suivi-carte-actions">
          <label className="suivi-carte-statut">
            <span className="sr-label">Statut</span>
            <select value={statut} onChange={(e) => onStatut(e.target.value)}>
              {STATUTS_SUIVI.map((s: StatutSuivi) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
            </select>
          </label>
          <button type="button" className="suivi-supprimer" onClick={supprimer} aria-label="Supprimer" disabled={isPending}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        </div>
      </div>

      <div className="suivi-carte-details">
        <label className="suivi-champ">
          <span>Relance prévue</span>
          <input type="date" value={relance} onChange={(e) => setRelance(e.target.value)} onBlur={(e) => sauverDetails(notes, e.target.value)} />
        </label>
        <label className="suivi-champ grow">
          <span>Notes</span>
          <textarea rows={2} value={notes} placeholder="Contact, ressenti, prochaine étape…" onChange={(e) => setNotes(e.target.value)} onBlur={(e) => sauverDetails(e.target.value, relance)} />
        </label>
      </div>

      <div className="suivi-relance">
        <button type="button" className="btn-ghost" onClick={genererMailRelance} disabled={isPending}>
          {isPending ? '…' : (relCorps ? 'Regénérer le mail de relance' : 'Générer un mail de relance')}
        </button>
        {relanceOuverte && (
          <div className="suivi-relance-bloc">
            <label>Objet<input value={relObjet} onChange={(e) => setRelObjet(e.target.value)} /></label>
            <label>Message<textarea rows={5} value={relCorps} onChange={(e) => setRelCorps(e.target.value)} /></label>
            <div className="suivi-relance-actions">
              <button type="button" className="btn-ghost" onClick={sauverRelance} disabled={isPending}>Enregistrer</button>
              <button type="button" className="btn-ghost" onClick={copierRelance}>Copier</button>
              <button type="button" className="btn-ghost" onClick={() => onStatut('relancee')} disabled={isPending}>J&apos;ai relancé</button>
            </div>
          </div>
        )}
        {info && <span className="cand-ok">{info}</span>}
        {erreur && <span className="cand-err">{erreur}</span>}
      </div>
    </div>
  )
}
