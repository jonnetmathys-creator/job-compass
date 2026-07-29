'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { OffreRow } from '@/lib/offres/types'
import type { Candidature } from '@/lib/candidature/types'
import { genererCandidature, enregistrerCandidature } from '@/lib/candidature/actions'
import LettreImprimable from './lettre-imprimable'
import LoadingOverlay from './loading-overlay'

const GENERATION_MSGS = [
  'Lecture de ton CV…',
  "Analyse de l'offre…",
  'Rédaction de ta lettre…',
  'Peaufinage du ton…',
]

export default function CandidatureEditor({
  offre, profilComplet, candidatureInitiale,
}: {
  offre: OffreRow
  profilComplet: boolean
  candidatureInitiale: Candidature | null
}) {
  const [cand, setCand] = useState<Candidature | null>(candidatureInitiale)
  const [objet, setObjet] = useState(candidatureInitiale?.email_objet ?? '')
  const [corps, setCorps] = useState(candidatureInitiale?.email_corps ?? '')
  const [lettre, setLettre] = useState(candidatureInitiale?.lettre ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [isPending, startTransition] = useTransition()

  function appliquer(c: Candidature) {
    setCand(c)
    setObjet(c.email_objet ?? '')
    setCorps(c.email_corps ?? '')
    setLettre(c.lettre ?? '')
  }

  function generer() {
    setErreur(null); setInfo(null); setGenerating(true)
    startTransition(async () => {
      try {
        appliquer(await genererCandidature(offre.id))
      } catch {
        setErreur('La génération a échoué, réessaie.')
      } finally {
        setGenerating(false)
      }
    })
  }

  function regenerer() {
    if (!window.confirm('Régénérer va remplacer la candidature actuelle. Continuer ?')) return
    generer()
  }

  function enregistrer() {
    setErreur(null); setInfo(null)
    startTransition(async () => {
      try {
        await enregistrerCandidature(offre.id, { email_objet: objet, email_corps: corps, lettre })
        setInfo('Enregistré ✓')
      } catch {
        setErreur("Échec de l'enregistrement, réessaie.")
      }
    })
  }

  async function copier(texte: string, message: string) {
    try {
      await navigator.clipboard.writeText(texte)
      setInfo(message)
    } catch {
      setErreur('Copie impossible.')
    }
  }

  function telechargerPdf() {
    window.print()
  }

  if (!profilComplet) {
    return (
      <div className="cand-empty">
        <p>Ajoute ton CV et ta lettre de base (PDF) dans ton profil avant de générer ta candidature.</p>
        <Link href="/profil" className="btn-primary">Compléter mon profil</Link>
      </div>
    )
  }

  if (!cand) {
    return (
      <div className="cand-empty">
        <button type="button" className="btn-primary" onClick={generer} disabled={isPending}>
          {isPending ? "L'IA rédige ta candidature…" : 'Générer ma candidature'}
        </button>
        {erreur && <p className="cand-err">{erreur}</p>}
        {generating && <LoadingOverlay messages={GENERATION_MSGS} />}
      </div>
    )
  }

  return (
    <div className="cand-editor">
      <section className="cand-block">
        <h3>Email de candidature</h3>
        <label htmlFor="objet">Objet</label>
        <input id="objet" value={objet} onChange={(e) => setObjet(e.target.value)} />
        <label htmlFor="corps">Corps de l'email</label>
        <textarea id="corps" rows={7} value={corps} onChange={(e) => setCorps(e.target.value)} />
        <button type="button" className="btn-ghost" onClick={() => copier(`${objet}\n\n${corps}`, "L'email copié ✓")}>Copier l'email</button>
      </section>

      <section className="cand-block">
        <h3>Lettre de motivation</h3>
        <label htmlFor="lettre">Lettre</label>
        <textarea id="lettre" rows={16} value={lettre} onChange={(e) => setLettre(e.target.value)} />
        <div className="cand-actions">
          <button type="button" className="btn-ghost" onClick={() => copier(lettre, 'La lettre copiée ✓')}>Copier la lettre</button>
          <button type="button" className="btn-ghost" onClick={telechargerPdf}>Télécharger la lettre en PDF</button>
        </div>
      </section>

      <div className="cand-actions">
        <button type="button" className="btn-primary" onClick={enregistrer} disabled={isPending}>Enregistrer</button>
        <button type="button" className="btn-ghost" onClick={regenerer} disabled={isPending}>
          {isPending ? '…' : 'Régénérer'}
        </button>
        {info && <span className="cand-ok">{info}</span>}
        {erreur && <span className="cand-err">{erreur}</span>}
      </div>
      <LettreImprimable lettre={lettre} offre={offre} />
      {generating && <LoadingOverlay messages={GENERATION_MSGS} />}
    </div>
  )
}
