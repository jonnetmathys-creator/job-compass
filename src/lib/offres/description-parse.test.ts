import { expect, test } from 'vitest'
import { structurerOffre } from './description-parse'
import type { OffreRow } from './types'

function offre(p: Partial<OffreRow>): OffreRow {
  return {
    id: 'o1', source: 'france_travail', source_id: 'o1', titre: 'Diététicien', entreprise: null, entreprise_logo: null,
    description: null, contrat: null, salaire: null, latitude: null, longitude: null, ville: null,
    url_postuler: null, email_contact: null, date_publication: null, ...p,
  }
}

const REZE = "Diététicien / Diététicienne (H/F) 44 - REZE (44400) Diététicienne Nutritionniste installée en libéral depuis 22 ans, je recherche un(e) remplaçant(e) très motivé(e), pour me remplacer 3 jours par semaine (mardi, mercredi et un samedi sur 2). Le poste est à pourvoir dès Septembre sachant qu'il faudra compter une petite période de formation avant la prise de poste. Descriptif du poste: -Accueil du patient, bilan diététique. -Prise de RDV téléphonique, rappel des patients. Doctolib. -Encaissement des chèques. -Consultations au domicile à la demande. Qualités requises: -Bonnes connaissances en alimentation et physiopathologie. -Aisance orale. -Dynamisme, sourire et empathie. Cas de patients observés: -Surpoids/ Obésité. -Sportifs. -Femmes enceintes. -Diabète 1 et 2. Rémunération: Rétrocession d'honoraires de 50%. Envoyer CV à: sandra.ferreira.dieteticienne@gmail.com"

test('offre riche : En bref + sections + email', () => {
  const s = structurerOffre(offre({ ville: 'Rezé (44400)', description: REZE }))
  const cles = s.enBref.map((f) => f.cle)
  expect(cles).toContain('lieu')
  expect(cles).toContain('rythme')
  expect(cles).toContain('remuneration')
  expect(cles).toContain('prise_poste')
  expect(s.enBref.find((f) => f.cle === 'remuneration')?.valeur).toBe('Rétrocession 50 %')
  expect(s.enBref.length).toBeLessThanOrEqual(6)

  const titres = s.sections.map((x) => x.titre)
  expect(titres).toContain('Le poste')
  expect(titres).toContain('Vos missions')
  expect(titres).toContain('Profil recherché')
  expect(titres).toContain('Cas suivis')
  // La rémunération ne fait pas de section (elle est dans En bref)
  expect(titres).not.toContain('Rémunération')

  const missions = s.sections.find((x) => x.titre === 'Vos missions')
  expect(missions?.type).toBe('liste')
  if (missions?.type === 'liste') expect(missions.items.length).toBeGreaterThanOrEqual(3)

  const cas = s.sections.find((x) => x.titre === 'Cas suivis')
  expect(cas?.type).toBe('chips')

  expect(s.email).toBe('sandra.ferreira.dieteticienne@gmail.com')
  // La consigne de candidature collée après la rémunération est récupérée, sans l'email.
  expect(s.noteCandidature).toContain('CV')
  expect(s.noteCandidature).not.toContain('@')
})

test('champs structurés remplis : En bref sur contrat/salaire/lieu/date', () => {
  const s = structurerOffre(offre({
    contrat: 'CDD - 12 mois', salaire: 'Selon grille', ville: 'Paris (75)', date_publication: '2026-08-11',
    description: 'Au sein du service, vous assurez le suivi nutritionnel des patients.',
  }))
  const cles = s.enBref.map((f) => f.cle)
  expect(cles).toEqual(expect.arrayContaining(['contrat', 'salaire', 'lieu', 'publiee']))
  expect(s.enBref.find((f) => f.cle === 'publiee')?.valeur).toBe('11 août')
  // Pas d'en-tête -> une seule section paragraphe
  expect(s.sections).toHaveLength(1)
  expect(s.sections[0]).toMatchObject({ type: 'paragraphe', titre: 'Le poste' })
})

test('offre pauvre : peu de faits (En bref masquable) + paragraphe propre', () => {
  const s = structurerOffre(offre({ description: 'Recherche un diététicien pour renforcer notre équipe.' }))
  expect(s.enBref.length).toBeLessThan(2) // le rendu masquera En bref
  expect(s.sections).toHaveLength(1)
  expect(s.sections[0].type).toBe('paragraphe')
  expect(s.email).toBeNull()
})

test('intitulés variés (L\'ÉTABLISSEMENT, LE POSTE, Missions principales) + contrat brut nettoyé', () => {
  const desc = "L'ÉTABLISSEMENT : Le centre hospitalier recherche à compter du 1er septembre un diététicien à temps partiel (70%). LE POSTE : Organisation de l'activité selon profil. Missions principales : -Élaboration du plan alimentaire. -Établissement des menus. -Réaliser les 4 étapes de la démarche diététique. Profil recherché : -Diplôme BTS diététique. -Rigueur et autonomie."
  const s = structurerOffre(offre({ contrat: 'contract', ville: '44 - Châteaubriant', description: desc }))
  // 'contract' générique est masqué
  expect(s.enBref.map((f) => f.cle)).not.toContain('contrat')
  expect(s.enBref.map((f) => f.cle)).toContain('lieu')
  expect(s.enBref.find((f) => f.cle === 'temps')?.valeur).toBe('Temps partiel')

  const titres = s.sections.map((x) => x.titre)
  expect(titres).toContain("L'établissement")
  expect(titres).toContain('Le poste')
  expect(titres).toContain('Vos missions')
  expect(titres).toContain('Profil recherché')
  const missions = s.sections.find((x) => x.titre === 'Vos missions')
  expect(missions?.type).toBe('liste')
  if (missions?.type === 'liste') expect(missions.puces).toBe('check')
})

test('« non précisé » est ignoré dans En bref', () => {
  const s = structurerOffre(offre({ contrat: 'Non précisé', salaire: 'Non précisé', ville: 'Nantes', description: 'x' }))
  const cles = s.enBref.map((f) => f.cle)
  expect(cles).not.toContain('contrat')
  expect(cles).not.toContain('salaire')
  expect(cles).toContain('lieu')
})
