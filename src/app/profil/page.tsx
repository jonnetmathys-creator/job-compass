import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getProfil, type Profil } from '@/lib/profil'
import { getFavoris } from '@/lib/favoris/lecture'
import ProfilForm from './profil-form'
import OffresLikees from '@/components/offres-likees'

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
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Mon profil</h1>
      <ProfilForm initial={initial} />
      <section className="mt-10">
        <div className="liked-headrow">
          <h3>Mes offres likées</h3>
          <span className="liked-count">{favoris.length} offre{favoris.length > 1 ? 's' : ''}</span>
        </div>
        <OffresLikees offres={favoris} />
      </section>
    </main>
  )
}
