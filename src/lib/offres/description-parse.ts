import type { OffreRow } from './types'

// Découpe heuristique d'une offre en « En bref » (faits clés) + sections lisibles.
// Objectif : transformer le pavé de texte des sources (France Travail…) en blocs
// clairs, SANS jamais afficher de bloc vide. Tout est best-effort : si rien n'est
// détecté, on retombe sur la description en paragraphe propre.

export type Fait = { cle: FaitCle; label: string; valeur: string }
export type FaitCle = 'contrat' | 'lieu' | 'rythme' | 'temps' | 'salaire' | 'remuneration' | 'prise_poste' | 'publiee' | 'formation'

export type IconeSection = 'poste' | 'missions' | 'profil' | 'cas'
export type Section =
  | { type: 'paragraphe'; titre: string; icone: IconeSection; texte: string }
  | { type: 'liste'; titre: string; icone: IconeSection; puces: 'check' | 'point'; items: string[] }
  | { type: 'chips'; titre: string; icone: IconeSection; items: string[] }

export type OffreStructuree = { enBref: Fait[]; sections: Section[]; email: string | null; noteCandidature: string | null }

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const RE_NON_PRECISE = /non\s*pr[ée]cis/i

function absent(v: string | null | undefined): boolean {
  return !v || !v.trim() || RE_NON_PRECISE.test(v)
}

function formatDatePub(iso: string): string {
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const jour = parseInt(m[3], 10)
  const mois = MOIS[parseInt(m[2], 10) - 1] ?? ''
  return `${jour} ${mois}`.trim()
}

function nettoyer(texte: string): string {
  return texte.replace(/\s+/g, ' ').trim()
}

// ---- En bref : faits extraits des champs + du texte, priorisés et plafonnés ----

function extraireFaits(offre: OffreRow, desc: string): Fait[] {
  const faits: Fait[] = []
  const bas = desc.toLowerCase()

  if (!absent(offre.contrat)) faits.push({ cle: 'contrat', label: 'Contrat', valeur: offre.contrat!.trim() })
  if (!absent(offre.ville)) faits.push({ cle: 'lieu', label: 'Lieu', valeur: offre.ville!.trim() })

  const rythme = bas.match(/(\d+)\s*(?:jours?|j)\s*(?:par|\/)\s*semaine/)
  if (rythme) faits.push({ cle: 'rythme', label: 'Rythme', valeur: `${rythme[1]} j/semaine` })

  const temps = bas.match(/temps\s+(plein|partiel|complet)/)
  if (temps) faits.push({ cle: 'temps', label: 'Temps', valeur: `Temps ${temps[1] === 'complet' ? 'plein' : temps[1]}` })

  if (!absent(offre.salaire)) {
    faits.push({ cle: 'salaire', label: 'Salaire', valeur: offre.salaire!.trim() })
  } else {
    const retro = bas.match(/r[ée]trocession[^%\d]*(\d{1,3})\s*%/)
    if (retro) faits.push({ cle: 'remuneration', label: 'Rémunération', valeur: `Rétrocession ${retro[1]} %` })
  }

  const prise = bas.match(/(?:d[eè]s|[àa]\s*compter\s*(?:du|de)?|[àa]\s*pourvoir\s*(?:d[eè]s|le)?)\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)/)
  if (prise) {
    const mot = prise[1]
    faits.push({ cle: 'prise_poste', label: 'Prise de poste', valeur: `Dès ${mot.charAt(0).toUpperCase()}${mot.slice(1)}` })
  }

  if (!absent(offre.date_publication)) faits.push({ cle: 'publiee', label: 'Publiée', valeur: formatDatePub(offre.date_publication!) })

  if (/formation/.test(bas) && /avant\s+(?:la\s+)?prise/.test(bas)) faits.push({ cle: 'formation', label: 'Formation', valeur: 'Prévue avant la prise' })

  // Dédup par clé, plafond 6.
  const vues = new Set<FaitCle>()
  return faits.filter((f) => (vues.has(f.cle) ? false : (vues.add(f.cle), true))).slice(0, 6)
}

// ---- Sections : découpage sur des intitulés connus + puces « - » ----

const RE_ENTETE = /\b(descriptif du poste|vos missions|missions|description du poste|activit[ée]s|profil recherch[ée]|qualit[ée]s requises|comp[ée]tences requises|comp[ée]tences|cas de patients observ[ée]s|cas suivis|pathologies suivies|pathologies|r[ée]mun[ée]ration|conditions|candidature|pour postuler)\s*:/gi

function classer(entete: string): { titre: string; icone: IconeSection; kind: 'check' | 'point' | 'chips' | 'skip' } {
  const e = entete.toLowerCase()
  if (/profil|qualit|comp[ée]tences/.test(e)) return { titre: 'Profil recherché', icone: 'profil', kind: 'point' }
  if (/cas|pathologies/.test(e)) return { titre: 'Cas suivis', icone: 'cas', kind: 'chips' }
  if (/r[ée]mun|conditions|candidature|postuler/.test(e)) return { titre: '', icone: 'poste', kind: 'skip' }
  return { titre: 'Vos missions', icone: 'missions', kind: 'check' }
}

// Découpe un segment en items de puces « - » ; renvoie null s'il n'y en a pas assez.
function itemsPuces(segment: string): string[] | null {
  const parts = segment.split(/\s*[-–•]\s+|\s+[-–•](?=[A-ZÉÀa-zéà])/).map((p) => nettoyer(p).replace(/[.;]+$/, '')).filter(Boolean)
  return parts.length >= 2 ? parts : null
}

export function structurerOffre(offre: OffreRow): OffreStructuree {
  const desc = offre.description ?? ''
  const enBref = extraireFaits(offre, desc)
  const email = offre.email_contact?.trim() || (desc.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null)

  // Localise les en-têtes.
  const bornes: { index: number; fin: number; titre: string; icone: IconeSection; kind: 'check' | 'point' | 'chips' | 'skip' }[] = []
  for (const m of desc.matchAll(RE_ENTETE)) {
    const c = classer(m[1])
    bornes.push({ index: m.index!, fin: m.index! + m[0].length, titre: c.titre, icone: c.icone, kind: c.kind })
  }

  const sections: Section[] = []

  if (bornes.length === 0) {
    // Aucune structure : description en paragraphe propre (jamais pire que le brut).
    const texte = nettoyer(desc)
    if (texte) sections.push({ type: 'paragraphe', titre: 'Le poste', icone: 'poste', texte })
    return { enBref, sections, email, noteCandidature: null }
  }

  // Intro avant le 1er en-tête -> « Le poste ».
  const intro = nettoyer(desc.slice(0, bornes[0].index))
  if (intro) sections.push({ type: 'paragraphe', titre: 'Le poste', icone: 'poste', texte: intro })

  let noteCandidature = ''
  bornes.forEach((b, i) => {
    const contenu = desc.slice(b.fin, i + 1 < bornes.length ? bornes[i + 1].index : undefined)
    if (b.kind === 'skip') {
      // On ne montre pas la rémunération ici (elle est dans En bref), mais on récupère
      // les consignes de candidature (CV, lettre, ADELI…) souvent collées juste après.
      const phrases = nettoyer(contenu).split(/(?<=\.)\s+/)
        .filter((p) => /envoyer|adresser|candidature|postuler|\bcv\b|lettre|dossier|adeli|rpps/i.test(p))
      if (phrases.length) noteCandidature += (noteCandidature ? ' ' : '') + phrases.join(' ')
      return
    }
    const items = itemsPuces(contenu)
    if (b.kind === 'chips') {
      if (items) sections.push({ type: 'chips', titre: b.titre, icone: b.icone, items })
      else { const t = nettoyer(contenu); if (t) sections.push({ type: 'paragraphe', titre: b.titre, icone: b.icone, texte: t }) }
    } else if (items) {
      sections.push({ type: 'liste', titre: b.titre, icone: b.icone, puces: b.kind, items })
    } else {
      const t = nettoyer(contenu)
      if (t) sections.push({ type: 'paragraphe', titre: b.titre, icone: b.icone, texte: t })
    }
  })

  // Nettoie la note : retire l'email (mis en bouton) et un éventuel « à : » final.
  const note = noteCandidature.replace(/[\w.+-]+@[\w.-]+/g, '').replace(/\s*[àa]\s*:?\s*$/i, '').replace(/\s+/g, ' ').trim()
  return { enBref, sections, email, noteCandidature: note || null }
}
