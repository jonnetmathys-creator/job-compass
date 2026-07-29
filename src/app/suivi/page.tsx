import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getSuivi } from '@/lib/suivi/lecture'
import SuiviListe from '@/components/suivi-liste'
import PageHeader from '@/components/page-header'

export default async function SuiviPage() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const items = await getSuivi(supabase, user.id)

  return (
    <section className="screen on">
      <PageHeader titre="Retour" />
      <div className="detail-scroll">
        <div className="detail-hero">
          <header className="detail-head">
            <div className="d-titletext">
              <h1>Suivi des candidatures</h1>
              <div className="d-emp">Ton tableau de bord de recherche d&apos;emploi</div>
            </div>
          </header>
        </div>
        <div className="detail-wrap">
          <SuiviListe items={items} />
        </div>
      </div>
    </section>
  )
}
