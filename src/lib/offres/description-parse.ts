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

// Nettoie une valeur de contrat : masque les valeurs génériques non informatives
// (ex. « contract » renvoyé brut par une source), capitalise sinon.
function propreContrat(v: string): string | null {
  const t = v.trim()
  if (/^contra(t|ct)s?$/i.test(t)) return null
  return t.charAt(0).toUpperCase() + t.slice(1)
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

function capitaliser(s: string): string {
  const t = s.toLowerCase().trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// ---- En bref : faits extraits des champs + du texte, priorisés et plafonnés ----

function extraireFaits(offre: OffreRow, desc: string): Fait[] {
  const faits: Fait[] = []
  const bas = desc.toLowerCase()

  const contrat = absent(offre.contrat) ? null : propreContrat(offre.contrat!)
  if (contrat) faits.push({ cle: 'contrat', label: 'Contrat', valeur: contrat })
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
  if (prise) faits.push({ cle: 'prise_poste', label: 'Prise de poste', valeur: `Dès ${capitaliser(prise[1])}` })

  if (!absent(offre.date_publication)) faits.push({ cle: 'publiee', label: 'Publiée', valeur: formatDatePub(offre.date_publication!) })

  if (/formation/.test(bas) && /avant\s+(?:la\s+)?prise/.test(bas)) faits.push({ cle: 'formation', label: 'Formation', valeur: 'Prévue avant la prise' })

  const vues = new Set<FaitCle>()
  return faits.filter((f) => (vues.has(f.cle) ? false : (vues.add(f.cle), true))).slice(0, 6)
}

// ---- Sections : découpage sur des intitulés connus + puces « - » ----

// Intitulés reconnus (suivis de « : »). Ordre : phrases longues avant courtes.
const RE_ENTETE = /\b(descriptif du poste|description du poste|missions principales|vos missions|votre mission|la mission|activit[ée]s principales|activit[ée]s|missions|t[âa]ches|profil recherch[ée]|qualit[ée]s requises|comp[ée]tences requises|comp[ée]tences|savoir[- ]?[êe]tre|savoir[- ]?faire|dipl[ôo]me|exp[ée]rience|l['’]\s*[ée]tablissement|l['’]\s*entreprise|pr[ée]sentation|contexte|le poste|cas de patients observ[ée]s|cas suivis|pathologies suivies|pathologies|r[ée]mun[ée]ration|conditions|candidature|pour postuler|contact)\s*:/gi

type Cat = 'profil' | 'cas' | 'skip' | 'missions' | 'contexte'

function classer(entete: string): { cat: Cat; titre: string; icone: IconeSection } {
  const e = entete.toLowerCase()
  if (/profil|qualit|comp[ée]tences|savoir|dipl[ôo]me|exp[ée]rience/.test(e)) return { cat: 'profil', titre: 'Profil recherché', icone: 'profil' }
  if (/cas|pathologies/.test(e)) return { cat: 'cas', titre: 'Cas suivis', icone: 'cas' }
  if (/r[ée]mun|conditions|candidature|postuler|salaire|adresser|contact/.test(e)) return { cat: 'skip', titre: '', icone: 'poste' }
  if (/mission|activit|t[âa]ches|descriptif/.test(e)) return { cat: 'missions', titre: 'Vos missions', icone: 'missions' }
  return { cat: 'contexte', titre: capitaliser(entete), icone: 'poste' }
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

  const bornes: { index: number; fin: number; cat: Cat; titre: string; icone: IconeSection }[] = []
  for (const m of desc.matchAll(RE_ENTETE)) {
    bornes.push({ index: m.index!, fin: m.index! + m[0].length, ...classer(m[1]) })
  }

  const sections: Section[] = []

  if (bornes.length === 0) {
    const texte = nettoyer(desc)
    if (texte) sections.push({ type: 'paragraphe', titre: 'Le poste', icone: 'poste', texte })
    return { enBref, sections, email, noteCandidature: null }
  }

  const intro = nettoyer(desc.slice(0, bornes[0].index))
  if (intro) sections.push({ type: 'paragraphe', titre: 'Le poste', icone: 'poste', texte: intro })

  let noteCandidature = ''
  bornes.forEach((b, i) => {
    const contenu = desc.slice(b.fin, i + 1 < bornes.length ? bornes[i + 1].index : undefined)
    if (b.cat === 'skip') {
      const phrases = nettoyer(contenu).split(/(?<=\.)\s+/)
        .filter((p) => /envoyer|adresser|candidature|postuler|\bcv\b|lettre|dossier|adeli|rpps/i.test(p))
      if (phrases.length) noteCandidature += (noteCandidature ? ' ' : '') + phrases.join(' ')
      return
    }
    const items = itemsPuces(contenu)
    if (b.cat === 'cas') {
      if (items) sections.push({ type: 'chips', titre: b.titre, icone: b.icone, items })
      else { const t = nettoyer(contenu); if (t) sections.push({ type: 'paragraphe', titre: b.titre, icone: b.icone, texte: t }) }
    } else if (items) {
      sections.push({ type: 'liste', titre: b.titre, icone: b.icone, puces: b.cat === 'profil' ? 'point' : 'check', items })
    } else {
      const t = nettoyer(contenu)
      if (t) sections.push({ type: 'paragraphe', titre: b.titre, icone: b.icone, texte: t })
    }
  })

  const note = noteCandidature.replace(/[\w.+-]+@[\w.-]+/g, '').replace(/\s*[àa]\s*:?\s*$/i, '').replace(/\s+/g, ' ').trim()
  return { enBref, sections, email, noteCandidature: note || null }
}
