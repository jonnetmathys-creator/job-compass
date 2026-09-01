// N'autorise que les URL http(s). Une valeur `javascript:`, `data:` ou autre
// protocole rendue comme lien cliquable (`<a href>`) serait un vecteur XSS
// stocké : on assainit à l'écriture (collecte + saisie manuelle). Retourne
// l'URL si elle est sûre, sinon null.
export function urlPostulerSure(u: string | null | undefined): string | null {
  if (!u) return null
  try {
    const p = new URL(u).protocol
    return p === 'http:' || p === 'https:' ? u : null
  } catch {
    return null
  }
}
