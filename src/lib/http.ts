// Borne de temps sur un appel réseau. Sans cela, un provider qui pend bloque
// toute la collecte (synchrone) : le budget du refresh ne vérifie la deadline
// qu'ENTRE les recherches, jamais à l'intérieur d'un fetch. Un fetch sans
// timeout peut donc geler le run entier au-delà du budget (constaté : 0 octet
// reçu en 700 s côté prod).
export const TIMEOUT_RESEAU_MS = 15000

// Enveloppe fetchImpl en ajoutant un AbortSignal.timeout. Réutilise le signal
// éventuel de l'appelant n'est pas géré : aucun appelant n'en passe ici.
export async function fetchAvecDelai(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit = {},
  timeoutMs: number = TIMEOUT_RESEAU_MS,
): Promise<Response> {
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
}
