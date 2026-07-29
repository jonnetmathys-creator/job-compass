import { notFound, redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { OFFRE_COLUMNS, type OffreRow } from '@/lib/offres/types'
import { getProfil } from '@/lib/profil'
import { getCandidature } from '@/lib/candidature/lecture'
import CandidatureEditor from '@/components/candidature-editor'
import PageHeader from '@/components/page-header'

export default async function CandidaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: offre } = await supabase.from('offres').select(OFFRE_COLUMNS).eq('id', id).single()
  if (!offre) notFound()

  const [profil, candidature] = await Promise.all([
    getProfil(supabase, user.id),
    getCandidature(supabase, user.id, id),
  ])
  const profilComplet = Boolean(profil?.cv_url && profil?.lettre_url)
  const o = offre as OffreRow

  return (
    <section className="screen on">
      <PageHeader titre="Retour" />
      <div className="detail-scroll">
        <div className="detail-hero">
          <header className="detail-head">
            <div className="d-titletext">
              <h1>Candidater : {o.titre}</h1>
              <div className="d-emp">
                <b>{o.entreprise ?? 'Employeur non précisé'}</b>{o.ville ? ` · ${o.ville}` : ''}
              </div>
            </div>
          </header>
        </div>
        <div className="detail-wrap">
          <CandidatureEditor offre={o} profilComplet={profilComplet} candidatureInitiale={candidature} />
        </div>
      </div>
    </section>
  )
}
