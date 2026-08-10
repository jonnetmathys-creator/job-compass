import ClocheNotifs from './cloche-notifs'
import CompteMenu from './compte-menu'

// Groupe cloche + menu compte, à placer à droite d'une barre d'en-tête existante
// (barre de filtres sur la recherche, PageHeader sur les pages détail).
export default function HeaderActions() {
  return (
    <div className="header-actions">
      <ClocheNotifs />
      <CompteMenu />
    </div>
  )
}
