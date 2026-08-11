import { ImageResponse } from 'next/og'
import { getServiceClient } from '@/lib/supabase/service'

// Carte d'aperçu (Snap, iMessage, WhatsApp, LinkedIn…) générée à la volée pour chaque offre.
export const alt = 'Offre en diététique sur JobCompass'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let titre = 'Offre en diététique'
  let emp = ''
  let contrat = ''
  try {
    const service = getServiceClient()
    const { data } = await service.from('offres').select('titre, entreprise, ville, contrat').eq('id', id).single()
    if (data) {
      titre = data.titre ?? titre
      emp = [data.entreprise, data.ville].filter(Boolean).join(' · ')
      contrat = data.contrat ?? ''
    }
  } catch { /* aperçu générique si lecture impossible */ }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'linear-gradient(135deg, #ffffff 0%, #e7f5ec 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 46, fontWeight: 800, letterSpacing: -1, color: '#0f1f16' }}>
          <span>Job</span><span style={{ color: '#248049' }}>Compass</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {contrat
            ? <div style={{ display: 'flex', alignSelf: 'flex-start', background: '#d8f0e2', color: '#1c6b3f', fontSize: 30, fontWeight: 700, padding: '10px 26px', borderRadius: 999, marginBottom: 26 }}>{contrat}</div>
            : null}
          <div style={{ display: 'flex', fontSize: 74, fontWeight: 800, color: '#0f1f16', lineHeight: 1.05 }}>{titre.slice(0, 88)}</div>
          {emp ? <div style={{ display: 'flex', fontSize: 38, fontWeight: 600, color: '#4a5a51', marginTop: 24 }}>{emp.slice(0, 70)}</div> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 700, color: '#248049' }}>
          Voir l&apos;offre et postuler →
        </div>
      </div>
    ),
    { ...size },
  )
}
