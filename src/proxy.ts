// Next.js 16 : le fichier `middleware.ts` est déprécié au profit de `proxy.ts`
// (fonction exportée renommée `proxy`, runtime Node.js). Voir
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
// Comportement, routes protégées et matcher identiques à la spec du brief tâche 4.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  const isProtected = ['/profil', '/offres', '/recherche', '/offre', '/parametres'].some((p) =>
    request.nextUrl.pathname.startsWith(p))
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return response
}

export const config = {
  matcher: ['/profil/:path*', '/offres/:path*', '/recherche/:path*', '/offre/:path*', '/parametres/:path*'],
}
