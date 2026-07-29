export type StatutSuivi = 'postulee' | 'relancee' | 'entretien' | 'acceptee' | 'refusee'

// Ordre d'affichage des sections du dashboard.
export const STATUTS_SUIVI: StatutSuivi[] = ['postulee', 'relancee', 'entretien', 'acceptee', 'refusee']

export const STATUT_LABEL: Record<StatutSuivi, string> = {
  postulee: 'Postulée',
  relancee: 'Relancée',
  entretien: 'Entretien',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
}

export function estStatutSuivi(v: string): v is StatutSuivi {
  return (STATUTS_SUIVI as string[]).includes(v)
}
