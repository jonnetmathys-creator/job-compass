export type OffreRelance = { id: string; titre: string; entreprise: string | null; ville: string | null }

// Corps HTML de l'email « candidatures à relancer ». Le CTA renvoie vers le suivi,
// où le générateur de mail de relance IA est disponible pour chaque candidature.
export function buildRelanceEmailHtml(offres: OffreRelance[], baseUrl: string): string {
  const items = offres
    .map((o) => {
      const lieu = [o.entreprise, o.ville].filter(Boolean).join(' · ')
      return `<li style="margin:0 0 8px"><b style="color:#1c1e21">${o.titre}</b>${lieu ? `<br><span style="color:#6b7280;font-size:13px">${lieu}</span>` : ''}</li>`
    })
    .join('')
  const n = offres.length
  const titre = n > 1 ? `${n} candidatures à relancer` : 'Une candidature à relancer'
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
<h2 style="color:#1c1e21">⏰ ${titre}</h2>
<p style="color:#6b7280">Ces candidatures sont sans réponse depuis un moment. C'est le bon moment pour relancer :</p>
<ul style="list-style:none;padding:0">${items}</ul>
<p style="margin:18px 0"><a href="${baseUrl}/suivi" style="background:#248049;color:#fff;text-decoration:none;border-radius:8px;padding:10px 18px;font-weight:600;display:inline-block">Ouvrir mon suivi</a></p>
<p style="color:#9aa0a6;font-size:12px">JobCompass · l'IA peut te rédiger le mail de relance en un clic.</p></div>`
}

export function sujetRelance(offres: unknown[]): string {
  return offres.length > 1
    ? `⏰ ${offres.length} candidatures à relancer`
    : '⏰ Une candidature à relancer'
}
