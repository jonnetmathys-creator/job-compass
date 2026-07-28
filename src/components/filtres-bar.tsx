'use client'
import { useState, useTransition } from 'react'
import { affinerLieu } from '@/lib/recherche/actions'
import VilleAutocomplete from './ville-autocomplete'

const RAYONS = [
  { label: 'France entière', v: null }, { label: '10 km', v: 10 }, { label: '25 km', v: 25 },
  { label: '50 km', v: 50 }, { label: '100 km', v: 100 },
]

export default function FiltresBar(props: {
  poste: string
  contrats: string[]
  contrat: string
  onContrat: (c: string) => void
  rechercheId: string
}) {
  const [ville, setVille] = useState('')
  const [rayon, setRayon] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  const relancer = (r: number | null = rayon) => startTransition(async () => {
    setErreur(null)
    const res = await affinerLieu(props.rechercheId, ville, r)
    if (!res.ok) setErreur(res.erreur ?? 'Erreur')
  })

  return (
    <div className="topbar">
      <div className="logo" style={{ fontSize: 19, marginRight: 6 }}>Job<span>Compass</span></div>
      <div className="poste-chip">{props.poste}</div>
      <div className="field">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
        <VilleAutocomplete value={ville} onChange={setVille} onValider={() => relancer()} />
      </div>
      <div className="field">
        <select aria-label="Rayon" value={String(rayon)} onChange={(e) => { const v = e.target.value === 'null' ? null : Number(e.target.value); setRayon(v); relancer(v) }}>
          {RAYONS.map((r) => <option key={r.label} value={String(r.v)}>{r.label}</option>)}
        </select>
      </div>
      <div className="field">
        <select aria-label="Type de contrat" value={props.contrat} onChange={(e) => props.onContrat(e.target.value)}>
          <option value="">Tous contrats</option>
          {props.contrats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="spacer" />
      {pending && <span className="count">Actualisation...</span>}
      {erreur && <span className="count" style={{ color: '#d14343' }}>{erreur}</span>}
    </div>
  )
}
