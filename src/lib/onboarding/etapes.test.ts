import { expect, test } from 'vitest'
import { ETAPES, etapeSuivante, etapePrecedente, estDerniere, pageCorrespond } from './etapes'

test('ETAPES couvre le parcours en 9 étapes ordonnées', () => {
  expect(ETAPES).toHaveLength(9)
  expect(ETAPES[0].action).toBe('recherche')
  expect(ETAPES.find((e) => e.action === 'offre')?.id).toBe('cloche')
  expect(ETAPES.every((e) => e.cible && e.titre && e.texte)).toBe(true)
})

test('etapeSuivante avance et sature à la dernière', () => {
  expect(etapeSuivante(0, 9)).toBe(1)
  expect(etapeSuivante(8, 9)).toBe(8)
})

test('etapePrecedente recule et sature à zéro', () => {
  expect(etapePrecedente(3)).toBe(2)
  expect(etapePrecedente(0)).toBe(0)
})

test('estDerniere vraie seulement sur le dernier index', () => {
  expect(estDerniere(8, 9)).toBe(true)
  expect(estDerniere(7, 9)).toBe(false)
})

test('pageCorrespond confronte le pathname au motif de l’étape', () => {
  const accueil = ETAPES[0]
  expect(pageCorrespond(accueil, '/')).toBe(true)
  expect(pageCorrespond(accueil, '/recherche/abc')).toBe(false)
  const filtres = ETAPES.find((e) => e.id === 'filtres')!
  expect(pageCorrespond(filtres, '/recherche/xyz')).toBe(true)
  expect(pageCorrespond(filtres, '/')).toBe(false)
  const compte = ETAPES.find((e) => e.id === 'compte')!
  expect(pageCorrespond(compte, '/recherche/xyz')).toBe(true)
  expect(pageCorrespond(compte, '/offre/xyz')).toBe(true)
})
