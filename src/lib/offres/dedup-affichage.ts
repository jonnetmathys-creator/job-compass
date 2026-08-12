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

export function empreinteOffre(o: Pick<OffreRow, 'titre' | 'ville' | 'entreprise'>): string {
  return `${norm(o.titre)}|${norm(o.ville)}|${norm(o.entreprise)}`
}

// ---- Rapprochement tolérant (titres différents, lieu manquant, même description) ----

function tokensTitre(s: string | null): string[] {
  return norm(s).split(' ').filter((t) => t.length >= 3)
}

// Deux tokens « proches » : égaux, ou l'un préfixe de l'autre (≥5 lettres) -> diététicien≈diététicienne.
function tokenProche(x: string, y: string): boolean {
  if (x === y) return true
  const [court, long] = x.length <= y.length ? [x, y] : [y, x]
  return court.length >= 5 && long.startsWith(court)
}

// Similarité de titre : chevauchement symétrique de tokens, dans [0, 1].
export function similariteTitre(a: string | null, b: string | null): number {
  const ta = tokensTitre(a), tb = tokensTitre(b)
  if (ta.length === 0 || tb.length === 0) return 0
  const ma = ta.filter((t) => tb.some((u) => tokenProche(t, u))).length
  const mb = tb.filter((t) => ta.some((u) => tokenProche(t, u))).length
  return (ma + mb) / (ta.length + tb.length)
}

// Ensemble des groupes de `taille` mots consécutifs de la description normalisée.
function shingles(desc: string | null, taille = 4): Set<string> {
  const mots = norm(desc).split(' ').filter(Boolean)
  const s = new Set<string>()
  for (let i = 0; i + taille <= mots.length; i++) s.add(mots.slice(i, i + taille).join(' '))
  return s
}

// Coefficient de recouvrement |A∩B| / min(|A|,|B|) : robuste aux troncatures.
// 0 si trop peu de contenu de part et d'autre (peu fiable).
function recouvrementDescription(a: Set<string>, b: Set<string>): number {
  if (a.size < 8 || b.size < 8) return 0
  const [petit, grand] = a.size <= b.size ? [a, b] : [b, a]
  let inter = 0
  for (const sh of petit) if (grand.has(sh)) inter++
  return inter / petit.size
}

type Signature = { o: OffreRow; emp: string; ville: string; email: string; sh: Set<string> }

function signature(o: OffreRow): Signature {
  return {
    o,
    emp: norm(o.entreprise),
    ville: norm(o.ville),
    email: (o.email_contact ?? '').trim().toLowerCase(),
    sh: shingles(o.description),
  }
}

const SEUIL_TITRE = 0.6
const SEUIL_DESC = 0.6

// a et b désignent-elles le même poste ?
function memePoste(a: Signature, b: Signature): boolean {
  // Villes renseignées des deux côtés et différentes -> jamais le même poste.
  if (a.ville && b.ville && a.ville !== b.ville) return false
  // Signaux forts, indépendants de l'employeur (dont le nom varie d'un site à l'autre).
  if (a.email && a.email === b.email) return true
  if (recouvrementDescription(a.sh, b.sh) >= SEUIL_DESC) return true
  // Rapprochement par titre : uniquement si le même employeur est renseigné des deux côtés.
  if (!a.emp || a.emp !== b.emp) return false
  return similariteTitre(a.o.titre, b.o.titre) >= SEUIL_TITRE
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
  // Regroupement glouton : on rattache chaque offre au premier groupe équivalent
  // (représentant = la plus complète), sinon on ouvre un nouveau groupe. Volumes
  // modestes par recherche, comparaisons pré-calculées via les signatures.
  const groupes: { rep: Signature; sources: string[] }[] = []
  for (const o of offres) {
    const sig = signature(o)
    const g = groupes.find((grp) => memePoste(grp.rep, sig))
    if (!g) {
      groupes.push({ rep: sig, sources: [o.source] })
    } else {
      if (!g.sources.includes(o.source)) g.sources.push(o.source)
      if (plusComplete(g.rep.o, o)) g.rep = sig
    }
  }
  const libelle = (s: string) => LIBELLES_SOURCE[s] ?? s
  return groupes.map((g) => {
    const plateformes = [
      libelle(g.rep.o.source),
      ...g.sources.filter((s) => s !== g.rep.o.source).map(libelle),
    ]
    return { ...g.rep.o, plateformes: [...new Set(plateformes)] }
  })
}
