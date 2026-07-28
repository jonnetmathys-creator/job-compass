import { expect, test } from 'vitest'
import { buildSearchParams, CODE_ROME_DIETETIQUE, MOTS_CLES_DIETETIQUE } from './keywords'

test('injecte le code ROME diététique', () => {
  const p = buildSearchParams({ mots_cles: [], localisation: '44109', rayon_km: 30, type_contrat: 'CDI' })
  expect(p.codeRome).toBe('J1402')
  expect(p.codeRome).toBe(CODE_ROME_DIETETIQUE)
})

test('fusionne les mots-clés de la recherche avec ceux par défaut, sans doublon', () => {
  const p = buildSearchParams({ mots_cles: ['nutrition', 'libéral'], localisation: '44109', rayon_km: 30, type_contrat: null })
  // nutrition est déjà par défaut : pas de doublon
  expect(p.motsCles.filter((m) => m === 'nutrition')).toHaveLength(1)
  expect(p.motsCles).toContain('libéral')
  for (const m of MOTS_CLES_DIETETIQUE) expect(p.motsCles).toContain(m)
})

test('mappe localisation/rayon/contrat', () => {
  const p = buildSearchParams({ mots_cles: [], localisation: '44109', rayon_km: 30, type_contrat: 'CDI' })
  expect(p.commune).toBe('44109')
  expect(p.distance).toBe(30)
  expect(p.typeContrat).toBe('CDI')
})
