import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getFavoris } from '@/lib/favoris/lecture'
import OffresLikees from '@/components/offres-likees'
import PageHeader from '@/components/page-header'

export default async function FavorisPage() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const favoris = await getFavoris(supabase, user.id)

  return (
    <section className="screen on">
      <PageHeader titre="Retour" />
      <div className="detail-scroll">
        <div className="detail-hero">
          <header className="detail-head">
            <div className="d-titlewrap">
              <div className="d-avatar liked">
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
              </div>
              <div className="d-titletext">
                <h1>Mes offres likées</h1>
                <div className="d-emp">{favoris.length} offre{favoris.length > 1 ? 's' : ''} sauvegardée{favoris.length > 1 ? 's' : ''}</div>
              </div>
            </div>
          </header>
        </div>
        <div className="detail-wrap">
          <OffresLikees offres={favoris} />
        </div>
      </div>
    </section>
  )
}
