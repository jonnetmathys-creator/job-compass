'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import PostulerModal, { type ReponsePostuler } from './postuler-modal'

// Bouton « Postuler » (lien ou action mail) + fenêtre de suivi au retour sur l'onglet.
// Quand l'utilisateur revient après avoir cliqué Postuler, on lui demande s'il a postulé.
export default function PostulerZone({
  offreId, statutInitial, label, href, onPostuler, hint, boutonClass = 'btn-apply',
}: {
  offreId: string
  statutInitial: string
  label: string
  href?: string | null
  onPostuler?: () => void
  hint?: string
  boutonClass?: string
}) {
  const [postule, setPostule] = useState(statutInitial !== 'brouillon')
  const [modal, setModal] = useState(false)
  const [rappel, setRappel] = useState(false)
  const arme = useRef(false)
  const parti = useRef(false)

  // Détecte le retour sur l'onglet (après mail/France Travail) pour proposer la fenêtre.
  useEffect(() => {
    function auRetour() {
      if (document.visibilityState !== 'visible') return
      if (arme.current && parti.current) {
        arme.current = false; parti.current = false
        setModal(true)
      }
    }
    function surVisibilite() {
      if (document.visibilityState === 'hidden') { if (arme.current) parti.current = true }
      else auRetour()
    }
    function surBlur() { if (arme.current) parti.current = true }
    document.addEventListener('visibilitychange', surVisibilite)
    window.addEventListener('blur', surBlur)
    window.addEventListener('focus', auRetour)
    return () => {
      document.removeEventListener('visibilitychange', surVisibilite)
      window.removeEventListener('blur', surBlur)
      window.removeEventListener('focus', auRetour)
    }
  }, [])

  function armer() {
    arme.current = true
    parti.current = false
    setRappel(false)
    if (onPostuler) onPostuler()
  }

  function fini(r: ReponsePostuler) {
    setModal(false)
    if (r === 'oui') setPostule(true)
    else if (r === 'pas_encore') setRappel(true)
  }

  if (postule) {
    return (
      <div className="postuler-toggle done">
        <span className="postuler-badge">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          Postulé
        </span>
        <Link href="/suivi" className="postuler-link">Voir le suivi</Link>
      </div>
    )
  }

  return (
    <>
      {href
        ? (
          <a className={boutonClass} href={href} target="_blank" rel="noopener" onClick={armer}>
            {label}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
          </a>
        )
        : onPostuler
          ? (
            <button type="button" className={boutonClass} onClick={armer}>{label}</button>
          )
          : <button type="button" className={boutonClass} disabled>Lien indisponible</button>}
      {hint && <p className="cand-postuler-hint">{hint}</p>}
      {rappel && (
        <p className="postuler-rappel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          Rappel programmé · on te le remettra dans la cloche.
        </p>
      )}
      {modal && <PostulerModal offreId={offreId} onFini={fini} />}
    </>
  )
}
