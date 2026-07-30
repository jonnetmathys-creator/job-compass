import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerClient } from '@/lib/supabase/server'
import { getProfil, type Profil } from '@/lib/profil'
import { getAlertes } from '@/lib/alertes/liste'
import ProfilForm from './profil-form'
import AlertesProfil from '@/components/alertes-profil'
import PageHeader from '@/components/page-header'
import OnboardingRejouer from '@/components/onboarding-rejouer'

export default async function ProfilPage() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [existing, alertes] = await Promise.all([
    getProfil(supabase, user.id),
    getAlertes(supabase, user.id),
  ])
  const initial: Profil = existing ?? {
    user_id: user.id, nom: null, titre_recherche: null, cv_url: null, lettre_base: null, lettre_url: null,
  }
  const initiale = (initial.nom?.trim()[0] ?? user.email?.trim()[0] ?? '?').toUpperCase()

  return (
    <section className="screen on">
      <PageHeader titre="Retour" />
      <div className="detail-scroll">
        <div className="detail-hero">
          <header className="detail-head">
            <div className="d-titlewrap">
              <div className="d-avatar">{initiale}</div>
              <div className="d-titletext">
                <h1>Mon profil</h1>
                <div className="d-emp">{user.email}</div>
              </div>
            </div>
          </header>
        </div>
        <div className="detail-wrap">
          <div className="side-card" style={{ padding: '22px 22px 26px', marginBottom: 20 }}>
            <ProfilForm initial={initial} />
          </div>
          <div className="side-card" style={{ padding: '20px 22px', marginBottom: 20 }}>
            <AlertesProfil alertes={alertes} />
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 6 }}>
              <OnboardingRejouer />
            </div>
          </div>
          <Link href="/favoris" className="profil-link">
            <span className="profil-link-ico">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
            </span>
            <span className="profil-link-txt">
              <b>Mes offres likées</b>
              <small>Retrouve les offres que tu as sauvegardées</small>
            </span>
            <svg className="profil-link-arr" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
