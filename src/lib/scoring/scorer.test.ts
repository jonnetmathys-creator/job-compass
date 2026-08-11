import { expect, test, vi } from 'vitest'
import { construirePromptScoring, scorerOffres } from './scorer'

const offre = (ref: string) => ({ ref, titre: 'Diététicien', entreprise: 'CH', ville: 'Nantes', contrat: 'CDI', description: 'x' })

test('construirePromptScoring inclut le CV et chaque ref', () => {
  const p = construirePromptScoring('MON CV', [offre('a'), offre('b')])
  expect(p).toContain('MON CV')
  expect(p).toContain('a')
  expect(p).toContain('b')
})

test('construirePromptScoring ajoute le bloc préférences quand elles existent', () => {
  const p = construirePromptScoring('CV', [offre('a')], ['Libéral / cabinet', 'CDI'])
  expect(p).toContain('Préférences du candidat')
  expect(p).toContain('Libéral / cabinet, CDI')
  expect(p).toContain('le CV reste le critère principal')
})

test('construirePromptScoring omet le bloc préférences si vide', () => {
  const p = construirePromptScoring('CV', [offre('a')], [])
  expect(p).not.toContain('Préférences du candidat')
})

test('scorerOffres découpe en lots et concatène', async () => {
  const appeler = vi.fn(async () => [{ ref: 'r', score: 80, raison: 'ok' }])
  const offres = Array.from({ length: 45 }, (_, i) => offre('o' + i)) // 3 lots (20+20+5)
  const notes = await scorerOffres('cv', offres, { appeler: appeler as any })
  expect(appeler).toHaveBeenCalledTimes(3)
  expect(notes.length).toBe(3) // 1 note simulée par lot
})

test('scorerOffres ignore un lot en échec', async () => {
  let n = 0
  const appeler = vi.fn(async () => { n++; if (n === 1) throw new Error('boom'); return [{ ref: 'x', score: 90, raison: 'ok' }] })
  const offres = Array.from({ length: 40 }, (_, i) => offre('o' + i)) // 2 lots
  const notes = await scorerOffres('cv', offres, { appeler: appeler as any })
  expect(notes.length).toBe(1) // le lot en échec est ignoré
})
