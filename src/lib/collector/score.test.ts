import { expect, test, vi } from 'vitest'
import { scoreOffre, scoreNouvellesOffres } from './score'

test('scoreOffre borne la valeur du modèle à 0-100', async () => {
  const anthropic = {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"score": 150}' }],
      }),
    },
  } as any
  const s = await scoreOffre(anthropic, 'Diététicienne Nantes', { titre: 'Diététicien EHPAD', description: null })
  expect(s).toBe(100) // 150 borné à 100
})

test('scoreNouvellesOffres ne score que les lignes sans score et écrit le résultat', async () => {
  // resultats sans score, joints à leur offre
  const rows = [{ offre_id: 'o1', offres: { titre: 'Diététicien EHPAD', description: 'x' } }]
  const is_ = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eq = vi.fn(() => ({ is: is_ }))
  const select = vi.fn(() => ({ eq }))
  const updEq2 = vi.fn().mockResolvedValue({ error: null })
  const updEq1 = vi.fn(() => ({ eq: updEq2 }))
  const update = vi.fn(() => ({ eq: updEq1 }))
  const client = { from: vi.fn(() => ({ select, update })) } as any

  const n = await scoreNouvellesOffres(client, 'rech-1', 'Diététicienne', {
    anthropic: {} as any,
    scoreOffre: vi.fn().mockResolvedValue(92),
  })
  expect(select).toHaveBeenCalled()
  expect(is_).toHaveBeenCalledWith('score_pertinence', null) // seulement les non scorées
  expect(update).toHaveBeenCalledWith({ score_pertinence: 92 })
  expect(n).toBe(1)
})
