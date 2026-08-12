import type { ReactNode } from 'react'
import type { OffreRow } from '@/lib/offres/types'
import { structurerOffre, type FaitCle, type IconeSection } from '@/lib/offres/description-parse'

const s2 = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const FACT_ICON: Record<FaitCle, ReactNode> = {
  contrat: <svg viewBox="0 0 24 24" {...s2}><path d="M3 7h18v13H3z" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
  lieu: <svg viewBox="0 0 24 24" {...s2}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>,
  rythme: <svg viewBox="0 0 24 24" {...s2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  temps: <svg viewBox="0 0 24 24" {...s2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  salaire: <svg viewBox="0 0 24 24" {...s2}><path d="M4 10h12M4 14h9" /><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7 7 0 0 0 7 12a7 7 0 0 0 6.8 8 7.7 7.7 0 0 0 5.2-2" /></svg>,
  remuneration: <svg viewBox="0 0 24 24" {...s2}><path d="M4 10h12M4 14h9" /><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7 7 0 0 0 7 12a7 7 0 0 0 6.8 8 7.7 7.7 0 0 0 5.2-2" /></svg>,
  prise_poste: <svg viewBox="0 0 24 24" {...s2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  publiee: <svg viewBox="0 0 24 24" {...s2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  formation: <svg viewBox="0 0 24 24" {...s2}><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" /></svg>,
}

const SEC_ICON: Record<IconeSection, ReactNode> = {
  poste: <svg viewBox="0 0 24 24" {...s2}><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  missions: <svg viewBox="0 0 24 24" {...s2}><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  profil: <svg viewBox="0 0 24 24" {...s2}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  cas: <svg viewBox="0 0 24 24" {...s2}><path d="M3 7h18v10H3z" /><path d="M3 11h18" /></svg>,
}

const MailIcon = () => <svg viewBox="0 0 24 24" {...s2}><path d="M4 4h16v16H4z" /><path d="m4 6 8 6 8-6" /></svg>

// Description d'offre en blocs lisibles : « En bref » + sections détectées.
// N'affiche que ce qui existe (pas de bloc vide, pas de doublon).
export default function OffreDescription({ offre }: { offre: OffreRow }) {
  const { enBref, sections, email, noteCandidature } = structurerOffre(offre)

  return (
    <div className="od">
      {enBref.length >= 2 && (
        <div className="od-enbref">
          <div className="od-enbref-h"><svg viewBox="0 0 24 24" {...s2}><path d="m12 3 2.1 4.9 5.3.5-4 3.5 1.2 5.2L12 14.8 7.4 17.6l1.2-5.2-4-3.5 5.3-.5z" /></svg>En bref</div>
          <div className="od-facts">
            {enBref.map((f) => (
              <div className="od-fact" key={f.cle}>
                <span className="od-fi">{FACT_ICON[f.cle]}</span>
                <div><div className="od-fl">{f.label}</div><div className="od-fv">{f.valeur}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.map((sec, i) => (
        <section className="od-sec" key={i}>
          <div className="od-sec-h"><span className="od-sh-ic">{SEC_ICON[sec.icone]}</span>{sec.titre}</div>
          {sec.type === 'paragraphe' && <p className="od-lede">{sec.texte}</p>}
          {sec.type === 'liste' && (
            <ul className={sec.puces === 'check' ? 'od-checks' : 'od-dots'}>
              {sec.items.map((it, j) => (
                <li key={j}>{sec.puces === 'check' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}<span>{it}</span></li>
              ))}
            </ul>
          )}
          {sec.type === 'chips' && (
            <div className="od-chips">{sec.items.map((it, j) => <span className="od-chip" key={j}>{it}</span>)}</div>
          )}
        </section>
      ))}

      {(email || noteCandidature) && (
        <section className="od-sec">
          <div className="od-sec-h"><span className="od-sh-ic"><MailIcon /></span>Candidature</div>
          {noteCandidature && <p className="od-cand-note">{noteCandidature}.</p>}
          {email && <a className="od-cta-mail" href={`mailto:${email}`}><MailIcon />{email}</a>}
        </section>
      )}
    </div>
  )
}
