import type { OffreRow } from './types'

const LIBELLES_SOURCE: Record<string, string> = {
  france_travail: 'France Travail',
  adzuna: 'Adzuna',
  afdn: 'AFDN',
  staffsante: 'StaffSanté',
  jooble: 'Jooble',
  manuelle: 'Ajout manuel',
}

export type OffreAffichee = OffreRow & { plateformes: string[] }

function norm(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .replace(/[()]/g, ' ')
    .replace(/\b[hf]\s*[/\-]\s*[hf]\b/g, ' ')          // h/f, f/h, h-f
    .replace(/[^a-z0-9\s]/g, ' ')                       // ponctuation
    .replace(/\s+/g, ' ')
    .trim()
}

function empreinte(o: OffreRow): string {
  return `${norm(o.titre)}|${norm(o.ville)}|${norm(o.entreprise)}`
}

// b est-elle strictement plus complète que a ? (coords > description > date récente)
function plusComplete(a: OffreRow, b: OffreRow): boolean {
  const coordA = a.latitude != null && a.longitude != null
  const coordB = b.latitude != null && b.longitude != null
  if (coordB !== coordA) return coordB
  const descA = !!a.description, descB = !!b.description
  if (descB !== descA) return descB
  const dA = a.date_publication ? Date.parse(a.date_publication) : -Infinity
  const dB = b.date_publication ? Date.parse(b.date_publication) : -Infinity
  return dB > dA
}

export function dedupeAffichage(offres: OffreRow[]): OffreAffichee[] {
  const groupes = new Map<string, { rep: OffreRow; sources: string[] }>()
  const ordre: string[] = []
  for (const o of offres) {
    const cle = empreinte(o)
    const g = groupes.get(cle)
    if (!g) {
      groupes.set(cle, { rep: o, sources: [o.source] })
      ordre.push(cle)
    } else {
      if (!g.sources.includes(o.source)) g.sources.push(o.source)
      if (plusComplete(g.rep, o)) g.rep = o
    }
  }
  const libelle = (s: string) => LIBELLES_SOURCE[s] ?? s
  return ordre.map((cle) => {
    const g = groupes.get(cle)!
    const plateformes = [
      libelle(g.rep.source),
      ...g.sources.filter((s) => s !== g.rep.source).map(libelle),
    ]
    return { ...g.rep, plateformes: [...new Set(plateformes)] }
  })
}
