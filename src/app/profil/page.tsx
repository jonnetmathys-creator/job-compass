import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getProfil, type Profil } from '@/lib/profil'
import { getFavoris } from '@/lib/favoris/lecture'
import ProfilForm from './profil-form'
import OffresLikees from '@/components/offres-likees'
import PageHeader from '@/components/page-header'

export default async function ProfilPage() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [existing, favoris] = await Promise.all([
    getProfil(supabase, user.id),
    getFavoris(supabase, user.id),
  ])
  const initial: Profil = existing ?? {
    user_id: user.id, nom: null, titre_recherche: null, cv_url: null, lettre_base: null,
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
          <div className="side-card" style={{ padding: '22px 22px 26px', marginBottom: 36 }}>
            <ProfilForm initial={initial} />
          </div>
          <section>
            <div className="liked-headrow">
              <h3>Mes offres likées</h3>
              <span className="liked-count">{favoris.length} offre{favoris.length > 1 ? 's' : ''}</span>
            </div>
            <OffresLikees offres={favoris} />
          </section>
        </div>
      </div>
    </section>
  )
}
