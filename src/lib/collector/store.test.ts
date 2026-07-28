import { expect, test, vi } from 'vitest'
import { storeOffres, linkResultats } from './store'
import type { NormalizedOffer } from './types'

function offer(id: string): NormalizedOffer {
  return {
    source: 'france_travail', source_id: id, titre: 'T', entreprise: null, description: null,
    contrat: null, salaire: null, latitude: null, longitude: null, ville: null,
    url_postuler: null, email_contact: null, date_publication: null,
  }
}

test('storeOffres upsert sur (source, source_id) et renvoie les ids', async () => {
  const rows = [{ id: 'uuid-1', source: 'france_travail', source_id: 'A' }]
  const select = vi.fn().mockResolvedValue({ data: rows, error: null })
  const upsert = vi.fn(() => ({ select }))
  const client = { from: vi.fn(() => ({ upsert })) } as any

  const stored = await storeOffres(client, [offer('A')])
  expect(client.from).toHaveBeenCalledWith('offres')
  expect(upsert).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ source: 'france_travail', source_id: 'A' })]),
    expect.objectContaining({ onConflict: 'source,source_id' }),
  )
  expect(stored[0]).toMatchObject({ id: 'uuid-1', source_id: 'A' })
})

test('linkResultats upsert une ligne resultats par offre sans écraser le score', async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const client = { from: vi.fn(() => ({ upsert })) } as any
  await linkResultats(client, 'rech-1', [{ id: 'uuid-1', source: 'x', source_id: 'A' }])
  expect(client.from).toHaveBeenCalledWith('resultats')
  const [payload, opts] = upsert.mock.calls[0]
  expect(payload).toEqual([expect.objectContaining({ recherche_id: 'rech-1', offre_id: 'uuid-1' })])
  // pas de score_pertinence dans le payload → un score existant n'est pas écrasé
  expect(payload[0]).not.toHaveProperty('score_pertinence')
  expect(opts).toMatchObject({ onConflict: 'recherche_id,offre_id', ignoreDuplicates: true })
})
