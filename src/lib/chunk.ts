// Découpe un tableau en lots de `taille` éléments.
// Sert notamment à borner la longueur des requêtes PostgREST `.in(col, [...])` :
// au-delà de ~16 Ko d'URL, undici (fetch de Node) rejette la requête
// (HeadersOverflowError). ~100 UUID par lot tiennent largement sous la limite.
export function chunk<T>(arr: T[], taille: number): T[][] {
  if (taille <= 0) throw new Error('taille de lot invalide')
  const lots: T[][] = []
  for (let i = 0; i < arr.length; i += taille) lots.push(arr.slice(i, i + taille))
  return lots
}
