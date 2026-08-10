'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ICONS: Record<string, React.ReactNode> = {
  recherche: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  favoris: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
  suivi: <><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m9 14 2 2 4-4" /></>,
  profil: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
}

const TABS = [
  { href: '/', label: 'Recherche', key: 'recherche', match: (p: string) => p === '/' || p.startsWith('/recherche') || p.startsWith('/offre') },
  { href: '/favoris', label: 'Favoris', key: 'favoris', match: (p: string) => p.startsWith('/favoris') },
  { href: '/suivi', label: 'Suivi', key: 'suivi', match: (p: string) => p.startsWith('/suivi') },
  { href: '/profil', label: 'Profil', key: 'profil', match: (p: string) => p.startsWith('/profil') || p.startsWith('/parametres') },
]

// Barre d'onglets fixée en bas, affichée uniquement sur mobile (voir CSS).
export default function BottomNav() {
  const pathname = usePathname()
  if (pathname === '/login' || pathname === '/signup') return null
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {TABS.map((t) => {
        const actif = t.match(pathname)
        return (
          <Link key={t.href} href={t.href} className={`bottom-nav-item${actif ? ' on' : ''}`} aria-current={actif ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[t.key]}
            </svg>
            <span>{t.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
