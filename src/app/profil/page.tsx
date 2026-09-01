import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getProfil, type Profil } from '@/lib/profil'
import { getAlertes } from '@/lib/alertes/liste'
import PageHeader from '@/components/page-header'
import ProfilBento from '@/components/profil-bento'

export default async function ProfilPage() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [existing, alertes] = await Promise.all([
    getProfil(supabase, user.id),
    getAlertes(supabase, user.id),
  ])
  const initial: Profil = existing ?? {
    user_id: user.id, nom: null, titre_recherche: null, cv_url: null, cv_texte: null,
    adresse: null, code_postal: null, ville: null, telephone: null, email: null,
    lettre_base: null, lettre_url: null, preferences: [],
  }
  const initiale = (initial.nom?.trim()[0] ?? user.email?.trim()[0] ?? '?').toUpperCase()

  return (
    <section className="screen on profil-screen">
      <div className="profil-aura" aria-hidden="true"></div>
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
          <ProfilBento initial={initial} alertes={alertes} emailCompte={user.email ?? ''} />
        </div>
      </div>
    </section>
  )
}
