import { getServerClient } from '@/lib/supabase/server'
import { getProfil, type Profil } from '@/lib/profil'
import ProfilForm from './profil-form'

export default async function ProfilPage() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const existing = user ? await getProfil(supabase, user.id) : null
  const initial: Profil = existing ?? {
    user_id: user!.id, nom: null, titre_recherche: null, cv_url: null, lettre_base: null,
  }
  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Mon profil</h1>
      <ProfilForm initial={initial} />
    </main>
  )
}
