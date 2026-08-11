import { expect, test } from 'vitest'
import { PREFERENCES, LABEL_PAR_CLE, nettoyerCles, clesVersLabels } from './preferences'

test('toutes les clés de préférences sont uniques', () => {
  const cles = PREFERENCES.flatMap((g) => g.options.map((o) => o.cle))
  expect(new Set(cles).size).toBe(cles.length)
})

test('LABEL_PAR_CLE couvre chaque option', () => {
  for (const g of PREFERENCES) for (const o of g.options) {
    expect(LABEL_PAR_CLE[o.cle]).toBe(o.label)
  }
})

test('nettoyerCles retire les clés inconnues et dédoublonne', () => {
  expect(nettoyerCles(['cdi', 'inconnu', 'cdi', 'liberal'])).toEqual(['cdi', 'liberal'])
})

test('clesVersLabels mappe et ignore les clés inconnues', () => {
  expect(clesVersLabels(['cdi', 'zzz', 'temps_partiel'])).toEqual(['CDI', 'Temps partiel'])
})
