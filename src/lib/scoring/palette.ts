// Couleur du badge de score : rouge (0) -> vert (100), teinte HSL continue.
export function couleurScore(score: number): string {
  const s = Math.max(0, Math.min(100, score))
  const teinte = Math.round(s * 1.2) // 0 = rouge, 120 = vert
  return `hsl(${teinte}, 68%, 42%)`
}

export function estTopMatch(score: number): boolean {
  return score >= 90
}
