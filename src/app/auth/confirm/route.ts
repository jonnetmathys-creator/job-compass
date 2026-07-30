import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'

// Cible du lien de confirmation d'email. On valide l'adresse (verifyOtp) puis on
// déconnecte immédiatement : l'utilisateur doit ressaisir email + mot de passe sur /login.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = await getServerClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?confirmed=1', origin))
    }
  }
  return NextResponse.redirect(new URL('/login?erreur=confirmation', origin))
}
