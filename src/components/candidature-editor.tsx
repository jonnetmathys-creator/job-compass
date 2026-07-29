'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { OffreRow } from '@/lib/offres/types'
import type { Candidature } from '@/lib/candidature/types'
import { genererCandidature, enregistrerCandidature } from '@/lib/candidature/actions'
import { marquerPostulee, retirerDuSuivi } from '@/lib/suivi/actions'
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
  const [statutSuivi, setStatutSuivi] = useState<string>(candidatureInitiale?.statut ?? 'brouillon')

  function appliquer(c: Candidature) {
    setCand(c)
    setObjet(c.email_objet ?? '')
    setCorps(c.email_corps ?? '')
    setLettre(c.lettre ?? '')
    setStatutSuivi(c.statut ?? 'brouillon')
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

  function postulerParEmail() {
    const dest = offre.email_contact ?? ''
    const href = `mailto:${dest}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`
    window.location.href = href
  }

  function jaiPostule() {
    setErreur(null)
    setStatutSuivi('postulee')
    startTransition(async () => {
      try {
        await marquerPostulee(offre.id)
      } catch {
        setStatutSuivi('brouillon')
        setErreur("Échec de l'enregistrement dans le suivi, réessaie.")
      }
    })
  }

  function retirerSuivi() {
    setErreur(null)
    setStatutSuivi('brouillon')
    startTransition(async () => {
      try {
        await retirerDuSuivi(offre.id)
      } catch {
        setStatutSuivi('postulee')
        setErreur('Échec du retrait du suivi, réessaie.')
      }
    })
  }

  // Profil incomplet : pas de génération possible.
  if (!profilComplet) {
    return (
      <div className="cand-state">
        <div className="cand-state-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 15h6M9 18h4" /></svg>
        </div>
        <h2>Profil incomplet</h2>
        <p>Ajoute ton CV et ta lettre de motivation de base (PDF) dans ton profil pour que l&apos;IA puisse rédiger ta candidature.</p>
        <Link href="/profil" className="btn-primary">Compléter mon profil</Link>
      </div>
    )
  }

  // Aucune candidature encore : gros bouton de génération.
  if (!cand) {
    return (
      <div className="cand-state">
        <div className="cand-state-ico ai">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z" /><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" /></svg>
        </div>
        <h2>Génère ta candidature</h2>
        <p>L&apos;IA rédige un email et une lettre de motivation personnalisés à partir de ton CV, ta lettre de base et cette offre. Tu pourras tout modifier ensuite.</p>
        <button type="button" className="btn-primary btn-lg" onClick={generer} disabled={isPending}>
          {isPending ? "L'IA rédige ta candidature…" : 'Générer ma candidature'}
        </button>
        {erreur && <p className="cand-err">{erreur}</p>}
        {generating && <LoadingOverlay messages={GENERATION_MSGS} />}
      </div>
    )
  }

  // Candidature présente : édition.
  return (
    <div className="cand-editor">
      <div className="cand-toolbar">
        <div className="cand-toolbar-btns">
          <button type="button" className="btn-primary" onClick={enregistrer} disabled={isPending}>Enregistrer</button>
          <button type="button" className="btn-ghost" onClick={regenerer} disabled={isPending}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
            Régénérer
          </button>
        </div>
        <div className="cand-toolbar-status">
          {info && <span className="cand-ok">{info}</span>}
          {erreur && <span className="cand-err">{erreur}</span>}
        </div>
      </div>

      <article className="cand-card">
        <header className="cand-card-head">
          <span className="cand-card-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>
          </span>
          <div>
            <h3>Email de candidature</h3>
            <small>À copier dans ton client mail</small>
          </div>
        </header>
        <div className="cand-card-body">
          <label htmlFor="objet">Objet</label>
          <input id="objet" value={objet} onChange={(e) => setObjet(e.target.value)} />
          <label htmlFor="corps">Corps de l&apos;email</label>
          <textarea id="corps" rows={7} value={corps} onChange={(e) => setCorps(e.target.value)} />
        </div>
        <footer className="cand-card-foot">
          <button type="button" className="btn-ghost" onClick={() => copier(`${objet}\n\n${corps}`, "L'email copié ✓")}>Copier l&apos;email</button>
        </footer>
      </article>

      <article className="cand-card">
        <header className="cand-card-head">
          <span className="cand-card-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h8M8 9h2" /></svg>
          </span>
          <div>
            <h3>Lettre de motivation</h3>
            <small>Personnalisée pour cette offre</small>
          </div>
        </header>
        <div className="cand-card-body">
          <label htmlFor="lettre">Lettre</label>
          <textarea id="lettre" rows={16} value={lettre} onChange={(e) => setLettre(e.target.value)} />
        </div>
        <footer className="cand-card-foot">
          <button type="button" className="btn-ghost" onClick={() => copier(lettre, 'La lettre copiée ✓')}>Copier la lettre</button>
          <button type="button" className="btn-ghost" onClick={telechargerPdf}>Télécharger en PDF</button>
        </footer>
      </article>

      <div className="cand-postuler">
        {offre.email_contact
          ? (
            <>
              <button type="button" className="btn-primary btn-lg" onClick={postulerParEmail}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>
                Postuler par email
              </button>
              <p className="cand-postuler-hint">
                Ton application mail s&apos;ouvre avec le destinataire, l&apos;objet et le message pré-remplis. Pense à joindre ton CV et ta lettre · utilise « Télécharger en PDF » ci-dessus. Les pièces jointes ne peuvent pas être ajoutées automatiquement.
              </p>
            </>
          )
          : offre.url_postuler
            ? (
              <>
                <a className="btn-primary btn-lg" href={offre.url_postuler} target="_blank" rel="noopener">
                  Postuler sur France Travail
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
                </a>
                <p className="cand-postuler-hint">Aucun email de contact sur cette offre : postule directement via le portail. Pense à joindre ton CV et ta lettre (« Télécharger en PDF »).</p>
              </>
            )
            : <button type="button" className="btn-primary btn-lg" disabled>Lien de candidature indisponible</button>}

        <div className="cand-suivi">
          {statutSuivi === 'brouillon'
            ? (
              <button type="button" className="btn-ghost" onClick={jaiPostule} disabled={isPending}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                J&apos;ai postulé
              </button>
            )
            : (
              <div className="cand-suivi-ok">
                <span className="cand-suivi-badge">Dans ton suivi ✓</span>
                <Link href="/suivi" className="cand-suivi-link">Voir dans le suivi</Link>
                <button type="button" className="cand-suivi-retirer" onClick={retirerSuivi} disabled={isPending}>Retirer du suivi</button>
              </div>
            )}
        </div>
      </div>

      <LettreImprimable lettre={lettre} offre={offre} />
      {generating && <LoadingOverlay messages={GENERATION_MSGS} />}
    </div>
  )
}
