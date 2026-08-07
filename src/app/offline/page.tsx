import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Hors ligne · JobCompass' }

// Page servie par le service worker quand l'appareil est hors ligne.
// Statique (aucune donnée), pour rester disponible sans réseau.
export default function OfflinePage() {
  return (
    <main className="offline-page">
      <div className="offline-card">
        <img src="/icon-192.png" alt="" width={72} height={72} className="offline-logo" />
        <h1>Tu es hors ligne</h1>
        <p>JobCompass a besoin d&apos;une connexion pour charger tes offres et ton suivi.</p>
        <p className="offline-hint">Vérifie ta connexion, la page se rechargera automatiquement une fois de retour en ligne.</p>
      </div>
      {/* Recharge dès que la connexion revient. */}
      <script
        dangerouslySetInnerHTML={{
          __html: "addEventListener('online',function(){location.reload()});",
        }}
      />
    </main>
  )
}
