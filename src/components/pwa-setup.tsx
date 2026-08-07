'use client'
import { useEffect, useState } from 'react'

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const REJET_CLE = 'jc-install-masque'

// Enregistre le service worker et propose une invite d'installation discrète.
export default function PwaSetup() {
  const [differe, setDiffere] = useState<PromptEvent | null>(null)
  const [iOS, setIOS] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* non bloquant */ })
    }

    const masque = (() => { try { return localStorage.getItem(REJET_CLE) === '1' } catch { return false } })()
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (masque || standalone) return

    const estIOS = /ipad|iphone|ipod/i.test(navigator.userAgent)
    if (estIOS) { setIOS(true); setVisible(true); return }

    const onPrompt = (e: Event) => { e.preventDefault(); setDiffere(e as PromptEvent); setVisible(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function fermer() {
    setVisible(false)
    try { localStorage.setItem(REJET_CLE, '1') } catch { /* ignore */ }
  }

  async function installer() {
    if (!differe) return
    await differe.prompt()
    await differe.userChoice.catch(() => null)
    setDiffere(null)
    fermer()
  }

  if (!visible) return null

  return (
    <div className="pwa-invite" role="dialog" aria-label="Installer JobCompass">
      <img src="/icon-192.png" alt="" width={40} height={40} className="pwa-invite-logo" />
      <div className="pwa-invite-txt">
        <b>Installer JobCompass</b>
        {iOS
          ? <span>Appuie sur Partager <span aria-hidden="true">⎋</span> puis « Sur l&apos;écran d&apos;accueil ».</span>
          : <span>Accès rapide, plein écran, comme une vraie app.</span>}
      </div>
      <div className="pwa-invite-actions">
        {!iOS && <button type="button" className="pwa-invite-ok" onClick={installer}>Installer</button>}
        <button type="button" className="pwa-invite-x" onClick={fermer} aria-label="Fermer">✕</button>
      </div>
    </div>
  )
}
