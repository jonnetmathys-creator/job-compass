import { expect, test, vi } from 'vitest'
import { buildRetouchePrompt, retoucherLettreCore } from './retouche'

test('buildRetouchePrompt inclut la consigne et le texte de la lettre', () => {
  const p = buildRetouchePrompt('Madame, Monsieur,\n\nJe me permets…', 'Raccourcis la lettre.')
  expect(p).toContain('Raccourcis la lettre.')
  expect(p).toContain('Je me permets')
  expect(p).toContain('{ lettre }')
})

test('retoucherLettreCore renvoie la lettre réécrite par le modèle', async () => {
  const appelerJson = vi.fn(async () => ({ lettre: 'Version raccourcie.' }))
  const out = await retoucherLettreCore('texte long', 'Raccourcis.', { appelerJson: appelerJson as never })
  expect(out).toBe('Version raccourcie.')
  expect(appelerJson).toHaveBeenCalledOnce()
})
