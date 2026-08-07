import { expect, test } from 'vitest'
import { preparerNotation, lignesScores } from './execution'

const o = (id: string, titre = 'Diététicien', ville = 'Nantes', entreprise: string | null = 'CH') =>
  ({ id, titre, ville, entreprise, contrat: null, description: null } as any)

test('preparerNotation ignore les offres déjà notées et dédoublonne', () => {
  const offres = [o('1'), o('2'), o('3', 'Diététicien', 'Rennes')] // 1 et 2 = même empreinte
  const { aNoter, membres } = preparerNotation(offres, new Set())
  expect(aNoter).toHaveLength(2)                 // un groupe Nantes, un groupe Rennes
  const grpNantes = membres.get(aNoter[0].ref)!
  expect(grpNantes.sort()).toEqual(['1', '2'])   // les deux ids du groupe
})

test('preparerNotation saute une offre déjà notée', () => {
  const { aNoter } = preparerNotation([o('1'), o('9', 'Autre', 'Brest')], new Set(['1']))
  expect(aNoter.map((x) => x.ref)).toEqual(['9'])
})

test('lignesScores réétale le score sur tous les ids du groupe', () => {
  const membres = new Map([['1', ['1', '2']]])
  const notes = new Map([['1', { ref: '1', score: 88, raison: 'ok' }]])
  const rows = lignesScores('u1', membres, notes)
  expect(rows).toEqual([
    { user_id: 'u1', offre_id: '1', score: 88, raison: 'ok' },
    { user_id: 'u1', offre_id: '2', score: 88, raison: 'ok' },
  ])
})

test('lignesScores clampe le score entre 0 et 100', () => {
  const rows = lignesScores('u1', new Map([['1', ['1']]]), new Map([['1', { ref: '1', score: 130, raison: 'x' }]]))
  expect(rows[0].score).toBe(100)
})
