// Extrait de actions.ts (fichier 'use server') : une fonction 'use server' ne peut
// exporter que des fonctions async. buildRechercheInsert est pure et synchrone,
// donc elle vit ici et est réexportée/importée par actions.ts et par le test.
export function buildRechercheInsert(userId: string, poste: string) {
  const p = poste.trim()
  return { user_id: userId, intitule: p, mots_cles: [p], localisation: null, rayon_km: null, type_contrat: null } as const
}
