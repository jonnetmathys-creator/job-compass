import type { CandidatureSuivi } from '@/lib/suivi/lecture'
import { STATUTS_SUIVI, STATUT_LABEL, type StatutSuivi } from '@/lib/suivi/statuts'
import { estARelancer } from '@/lib/suivi/dates'
import SuiviCarte from './suivi-carte'
import AjoutCandidature from './ajout-candidature'

export default function SuiviListe({ items }: { items: CandidatureSuivi[] }) {
  const today = new Date().toISOString().slice(0, 10)

  if (items.length === 0) {
    return (
      <div className="suivi-empty">
        <div className="suivi-empty-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>
        </div>
        <h2>Aucune candidature suivie</h2>
        <p>Quand tu postules à une offre et cliques « J&apos;ai postulé », elle apparaît ici pour que tu suives son avancement.</p>
        <a href="/" className="btn-primary">Chercher des offres</a>
        <AjoutCandidature />
      </div>
    )
  }

  const parStatut = (s: StatutSuivi) => items.filter((i) => i.statut === s)
  const nb = (ss: StatutSuivi[]) => items.filter((i) => ss.includes(i.statut as StatutSuivi)).length
  const enCours = nb(['postulee', 'relancee', 'entretien'])
  const entretiens = nb(['entretien'])
  const reponses = nb(['acceptee', 'refusee'])
  const aRelancer = items.filter((i) => estARelancer(i.statut, i.relance_le, today)).length

  return (
    <div className="suivi-dash">
      <div className="suivi-stats">
        <div className="suivi-stat"><b>{items.length}</b><span>Total</span></div>
        <div className="suivi-stat"><b>{enCours}</b><span>En cours</span></div>
        <div className="suivi-stat"><b>{entretiens}</b><span>Entretiens</span></div>
        <div className="suivi-stat"><b>{reponses}</b><span>Réponses</span></div>
      </div>

      <div className="suivi-barre">
        {aRelancer > 0 && <div className="suivi-relance-bandeau">{aRelancer} candidature{aRelancer > 1 ? 's' : ''} à relancer</div>}
        <AjoutCandidature />
      </div>

      {STATUTS_SUIVI.map((s) => {
        const list = parStatut(s)
        if (list.length === 0) return null
        return (
          <section key={s} className={`suivi-section st-${s}`}>
            <div className="suivi-section-head">
              <span className="suivi-dot" />
              <h3>{STATUT_LABEL[s]}</h3>
              <span className="suivi-section-count">{list.length}</span>
            </div>
            <div className="suivi-cards">
              {list.map((i) => <SuiviCarte key={i.offre.id} item={i} today={today} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
