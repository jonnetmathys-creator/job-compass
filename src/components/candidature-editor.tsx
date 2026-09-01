'use client'
import { useState, useRef, useTransition } from 'react'
import Link from 'next/link'
import type { OffreRow } from '@/lib/offres/types'
import type { Candidature } from '@/lib/candidature/types'
import { genererCandidature, enregistrerCandidature, retoucherLettre } from '@/lib/candidature/actions'
import LettreImprimable, { type Expediteur } from './lettre-imprimable'
import BarreIA, { type ActionIA } from './barre-ia'
import LoadingOverlay from './loading-overlay'
import PostulerZone from './postuler-zone'

const GENERATION_MSGS = [
  'Lecture de ton CV…',
  "Analyse de l'offre…",
  'Rédaction de ta lettre…',
  'Peaufinage du ton…',
]

// Actions IA de la barre flottante : chaque bouton = une consigne envoyée au modèle.
const ACTIONS_IA: ActionIA[] = [
  { cle: 'raccourcir', label: 'Raccourcir', consigne: "Raccourcis la lettre d'environ 25 %, en gardant les points forts et la structure.", path: 'M21 6H3M15 12H3M17 18H3' },
  { cle: 'formel', label: 'Plus formel', consigne: 'Rends le ton plus formel et professionnel, sans changer les faits.', path: 'M4 7V4h16v3M9 20h6M12 4v16' },
  { cle: 'percutant', label: 'Plus percutant', consigne: 'Rends la lettre plus percutante et affirmée, avec des phrases plus dynamiques.', path: 'M13 2 3 14h9l-1 8 10-12h-9z' },
  { cle: 'corriger', label: 'Corriger', consigne: "Corrige uniquement l'orthographe, la grammaire et la ponctuation, sans changer le style ni le contenu.", path: 'M20 6 9 17l-5-5' },
]

export default function CandidatureEditor({
  offre, profilComplet, candidatureInitiale, expediteur, dateFr,
}: {
  offre: OffreRow
  profilComplet: boolean
  candidatureInitiale: Candidature | null
  expediteur: Expediteur
  dateFr: string
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
  const [onglet, setOnglet] = useState<'lettre' | 'email'>('lettre')
  const [iaEnCours, setIaEnCours] = useState<string | null>(null)
  const [ton, setTon] = useState(50)
  const corpsRef = useRef<HTMLDivElement | null>(null)

  // Applique un texte de lettre à la fois dans l'état et dans la feuille éditable
  // (le contenteditable n'est pas re-rendu depuis l'état pour ne pas sauter le curseur).
  function poserLettre(txt: string) {
    setLettre(txt)
    if (corpsRef.current) { corpsRef.current.innerText = txt; corpsRef.current.dataset.seeded = 'y' }
  }

  function appliquer(c: Candidature) {
    setCand(c)
    setObjet(c.email_objet ?? '')
    setCorps(c.email_corps ?? '')
    poserLettre(c.lettre ?? '')
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

  // Retouche IA : envoie la lettre + consigne, applique la version réécrite.
  function lancerIA(consigne: string, cle: string) {
    if (iaEnCours) return
    setErreur(null); setInfo(null); setIaEnCours(cle)
    startTransition(async () => {
      try {
        const nouveau = await retoucherLettre(lettre, consigne)
        poserLettre(nouveau)
        setInfo('Lettre retouchée ✓')
      } catch {
        setErreur('La retouche IA a échoué, réessaie.')
      } finally {
        setIaEnCours(null)
      }
    })
  }

  function appliquerTon(v: number) {
    if (v < 40) lancerIA('Adopte un ton plus sobre, neutre et factuel.', 'ton')
    else if (v > 60) lancerIA('Adopte un ton plus chaleureux et humain, tout en restant professionnel.', 'ton')
    else { setTon(50) }
  }

  function collerTextePur(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    const t = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, t)
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

  const cpVille = [expediteur.codePostal, expediteur.ville].filter(Boolean).join(' ')
  const lieuDate = expediteur.ville ? `À ${expediteur.ville}, le ${dateFr}` : `Le ${dateFr}`

  // Candidature présente : éditeur document.
  return (
    <div className="cand-doc">
      {/* Barre d'outils : onglets + actions document */}
      <div className="cand-toolbar cand-doc-bar">
        <div className="cand-tabs">
          <button type="button" className={`cand-tab${onglet === 'lettre' ? ' actif' : ''}`} onClick={() => setOnglet('lettre')}>Lettre</button>
          <button type="button" className={`cand-tab${onglet === 'email' ? ' actif' : ''}`} onClick={() => setOnglet('email')}>Email</button>
        </div>
        <div className="cand-doc-actions">
          {info && <span className="cand-ok">{info}</span>}
          {erreur && <span className="cand-err">{erreur}</span>}
          <button type="button" className="btn-ghost btn-sm" onClick={regenerer} disabled={isPending}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
            Régénérer
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={telechargerPdf}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
            PDF
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={enregistrer} disabled={isPending}>Enregistrer</button>
        </div>
      </div>

      {onglet === 'lettre' ? (
        <>
          <BarreIA
            actions={ACTIONS_IA} iaEnCours={iaEnCours} disabled={isPending}
            onAction={lancerIA} ton={ton} onTonChange={setTon} onTonApply={appliquerTon}
          />
          <div className="cand-feuille-wrap">
            <div className="lettre-apercu cand-editable">
              <div className="li-top">
                <div className="li-exp">
                  {expediteur.nom ? <b>{expediteur.nom}</b> : null}
                  {expediteur.adresse ? <span>{expediteur.adresse}</span> : null}
                  {cpVille ? <span>{cpVille}</span> : null}
                  {expediteur.telephone ? <span>{expediteur.telephone}</span> : null}
                  {expediteur.email ? <span>{expediteur.email}</span> : null}
                </div>
                <div className="li-dest">
                  {offre.entreprise ? <b>{offre.entreprise}</b> : null}
                  {offre.ville ? <span>{offre.ville}</span> : null}
                </div>
              </div>
              <div className="li-date">{lieuDate}</div>
              <div className="li-objet">Objet : candidature au poste de {offre.titre}</div>
              <div
                ref={(el) => {
                  corpsRef.current = el
                  if (el && el.dataset.seeded !== 'y') { el.innerText = lettre; el.dataset.seeded = 'y' }
                }}
                className="li-corps"
                contentEditable
                suppressContentEditableWarning
                spellCheck
                onInput={(e) => setLettre(e.currentTarget.innerText)}
                onPaste={collerTextePur}
              />
            </div>
          </div>
        </>
      ) : (
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
            <textarea id="corps" rows={9} value={corps} onChange={(e) => setCorps(e.target.value)} />
          </div>
          <footer className="cand-card-foot">
            <button type="button" className="btn-ghost" onClick={() => copier(`${objet}\n\n${corps}`, "L'email copié ✓")}>Copier l&apos;email</button>
          </footer>
        </article>
      )}

      <div className="cand-postuler">
        {offre.email_contact
          ? (
            <PostulerZone offreId={offre.id} statutInitial={statutSuivi} label="Postuler par email" boutonClass="btn-primary btn-lg"
              onPostuler={postulerParEmail}
              hint="Ton application mail s'ouvre avec le destinataire, l'objet et le message pré-remplis. Pense à joindre ton CV et ta lettre · utilise « PDF » ci-dessus. Les pièces jointes ne peuvent pas être ajoutées automatiquement." />
          )
          : (
            <PostulerZone offreId={offre.id} statutInitial={statutSuivi} label="Postuler sur France Travail" boutonClass="btn-primary btn-lg"
              href={offre.url_postuler}
              hint="Aucun email de contact sur cette offre : postule directement via le portail. Pense à joindre ton CV et ta lettre (« PDF »)." />
          )}
      </div>

      <LettreImprimable lettre={lettre} offre={offre} expediteur={expediteur} dateFr={dateFr} />
      {generating && <LoadingOverlay messages={GENERATION_MSGS} />}
    </div>
  )
}
