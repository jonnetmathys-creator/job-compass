// Retour haptique multi-plateforme.
//
// Android / desktop : Vibration API (navigator.vibrate).
// iOS : la Vibration API n'existe pas. On utilise l'astuce reconnue de l'input
// `switch` (iOS 17.4+) : basculer un interrupteur natif déclenche un tap haptique.
// Le nœud est créé une seule fois, caché, et réutilisé.

let iosInput: HTMLInputElement | null = null

function assurerNoeudIos() {
  if (iosInput || typeof document === 'undefined') return
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  Object.assign(label.style, {
    position: 'absolute', width: '1px', height: '1px',
    overflow: 'hidden', opacity: '0', pointerEvents: 'none',
  } as CSSStyleDeclaration)
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '') // attribut iOS : rend l'input haptique au toggle
  label.appendChild(input)
  document.body.appendChild(label)
  iosInput = input
}

// Déclenche un léger retour haptique. `motif` : durée(s) en ms pour la Vibration API.
export function haptic(motif: number | number[] = 8) {
  if (typeof window === 'undefined') return
  try {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
    if (typeof nav.vibrate === 'function') { nav.vibrate(motif); return }
  } catch { /* ignore */ }
  // iOS : pas de vibrate — on bascule l'interrupteur caché.
  try {
    assurerNoeudIos()
    iosInput?.click() // le toggle de l'interrupteur émet le tap haptique
  } catch { /* ignore */ }
}
