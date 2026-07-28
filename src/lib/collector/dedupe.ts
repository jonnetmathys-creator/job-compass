import type { NormalizedOffer } from './types'

export function dedupeOffres(...lists: NormalizedOffer[][]): NormalizedOffer[] {
  const byKey = new Map<string, NormalizedOffer>()
  for (const list of lists) {
    for (const o of list) {
      const key = `${o.source}:${o.source_id}`
      if (!byKey.has(key)) byKey.set(key, o) // garde la première occurrence
    }
  }
  return [...byKey.values()]
}
