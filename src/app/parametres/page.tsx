import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import PageHeader from '@/components/page-header'
import ParametresForm from '@/components/parametres-form'

export default async function ParametresPage() {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <section className="screen on">
      <PageHeader titre="Retour" />
      <div className="detail-wrap">
        <h1 style={{ fontSize: 'clamp(22px, 2.6vw, 28px)', fontWeight: 800, marginBottom: 22 }}>
          Paramètres du compte
        </h1>
        <ParametresForm email={user.email ?? ''} />
      </div>
    </section>
  )
}
