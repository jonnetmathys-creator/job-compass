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
            <div className="cand-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z" /></svg>
              Candidature assistée par IA
            </div>
            <div className="d-titletext">
              <h1>Ta candidature</h1>
              <div className="d-emp">
                Pour <b>{o.titre}</b>{o.entreprise ? ` · ${o.entreprise}` : ''}{o.ville ? ` · ${o.ville}` : ''}
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
