// Taxonomie des préférences de poste (diététique). On stocke des CLÉS stables
// (ex. 'liberal', 'cdi') ; les libellés servent à l'affichage et à l'injection
// dans le prompt de scoring. Ajouter une option = ajouter une entrée ici.

export type OptionPref = { cle: string; label: string }
export type GroupePref = { titre: string; options: OptionPref[] }

export const PREFERENCES: GroupePref[] = [
  {
    titre: "Cadre d'exercice",
    options: [
      { cle: 'liberal', label: 'Libéral / cabinet' },
      { cle: 'hopital_chu', label: 'Hôpital / CHU' },
      { cle: 'clinique', label: 'Clinique' },
      { cle: 'ehpad', label: 'EHPAD / gériatrie' },
      { cle: 'restauration_collective', label: 'Restauration collective' },
      { cle: 'industrie_agro', label: 'Industrie agroalimentaire' },
      { cle: 'sante_publique', label: 'Santé publique / prévention' },
      { cle: 'nutrition_sport', label: 'Nutrition du sport' },
      { cle: 'enseignement', label: 'Enseignement / recherche' },
    ],
  },
  {
    titre: 'Type de contrat',
    options: [
      { cle: 'cdi', label: 'CDI' },
      { cle: 'cdd', label: 'CDD' },
      { cle: 'liberal_independant', label: 'Libéral / indépendant' },
      { cle: 'interim', label: 'Intérim / vacation' },
      { cle: 'stage', label: 'Stage' },
      { cle: 'alternance', label: 'Alternance' },
    ],
  },
  {
    titre: 'Temps de travail',
    options: [
      { cle: 'temps_plein', label: 'Temps plein' },
      { cle: 'temps_partiel', label: 'Temps partiel' },
    ],
  },
  {
    titre: 'Organisation',
    options: [
      { cle: 'presentiel', label: 'Présentiel' },
      { cle: 'teletravail', label: 'Télétravail possible' },
    ],
  },
]

// Libellé par clé, dérivé de PREFERENCES.
export const LABEL_PAR_CLE: Record<string, string> = Object.fromEntries(
  PREFERENCES.flatMap((g) => g.options.map((o) => [o.cle, o.label])),
)

// Ne garde que les clés connues, dédupliquées (défense contre des entrées invalides).
export function nettoyerCles(cles: string[]): string[] {
  const vues = new Set<string>()
  const out: string[] = []
  for (const c of cles) {
    if (LABEL_PAR_CLE[c] && !vues.has(c)) { vues.add(c); out.push(c) }
  }
  return out
}

// Convertit des clés en libellés lisibles (ignore les clés inconnues).
export function clesVersLabels(cles: string[]): string[] {
  return cles.map((c) => LABEL_PAR_CLE[c]).filter(Boolean)
}
