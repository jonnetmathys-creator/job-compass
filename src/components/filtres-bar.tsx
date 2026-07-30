'use client'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { affinerLieu } from '@/lib/recherche/actions'
import VilleAutocomplete from './ville-autocomplete'
import AlerteMailToggle from './alerte-mail-toggle'

export default function FiltresBar(props: {
  poste: string
  contrats: string[]
  contrat: string
  onContrat: (c: string) => void
  rechercheId: string
  initialLieu?: string
  initialRayon?: number | null
  alertesEmail: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const [ville, setVille] = useState(props.initialLieu ?? '')
  const [franceEntiere, setFranceEntiere] = useState((props.initialRayon ?? null) === null)
  const [rayonKm, setRayonKm] = useState<number>(props.initialRayon ?? 50)
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  // Fermeture au clic hors du menu.
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('#filtres')) setOuvert(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  function appliquer() {
    setErreur(null)
    const rayon = franceEntiere ? null : rayonKm
    startTransition(async () => {
      const res = await affinerLieu(props.rechercheId, ville, rayon)
      if (!res.ok) setErreur(res.erreur ?? 'Erreur')
      else setOuvert(false)
    })
  }

  // Nombre de filtres actifs (pour la pastille du bouton).
  const actifs = (ville.trim() ? 1 : 0) + (franceEntiere ? 0 : 1) + (props.contrat ? 1 : 0)

  return (
    <div className="topbar">
      <Link href="/" className="logo" style={{ fontSize: 19, marginRight: 6 }} aria-label="Retour à la recherche">Job<span>Compass</span></Link>
      <div className="poste-chip">{props.poste}</div>

      <div className="filtres" id="filtres">
        <button type="button" className={`filtres-btn${ouvert ? ' on' : ''}`} data-tour="filtres" onClick={(e) => { e.stopPropagation(); setOuvert((o) => !o) }} aria-expanded={ouvert}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          Filtres
          {actifs > 0 && <span className="filtres-count">{actifs}</span>}
          <svg className="filtres-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>

        <div className={`filtres-panel${ouvert ? ' on' : ''}`}>
          <div className="filtre-groupe">
            <label>Localisation</label>
            <div className="field">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              <VilleAutocomplete value={ville} onChange={setVille} onSelect={(c) => setVille(c.label)} onValider={appliquer} />
            </div>
          </div>

          <div className="filtre-groupe">
            <div className="filtre-slider-head">
              <label htmlFor="rayon">Distance</label>
              <span className="filtre-valeur">{franceEntiere ? 'France entière' : `${rayonKm} km`}</span>
            </div>
            <input id="rayon" type="range" min={10} max={200} step={1} value={rayonKm} disabled={franceEntiere}
              onChange={(e) => setRayonKm(Number(e.target.value))} className="filtre-slider" />
            <label className="filtre-check">
              <input type="checkbox" checked={franceEntiere} onChange={(e) => setFranceEntiere(e.target.checked)} />
              France entière
            </label>
          </div>

          <div className="filtre-groupe">
            <label htmlFor="contrat">Type de contrat</label>
            <select id="contrat" value={props.contrat} onChange={(e) => props.onContrat(e.target.value)}>
              <option value="">Tous contrats</option>
              {props.contrats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button type="button" className="btn-primary filtre-appliquer" onClick={appliquer} disabled={pending}>
            {pending ? 'Actualisation…' : 'Appliquer'}
          </button>
          {erreur && <p className="filtre-err">{erreur}</p>}
        </div>
      </div>

      <AlerteMailToggle rechercheId={props.rechercheId} actifInitial={props.alertesEmail} />

      <div className="spacer" />
      {pending && <span className="count">Actualisation…</span>}
    </div>
  )
}
