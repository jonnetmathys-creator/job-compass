import { expect, test, vi } from 'vitest'
import { creerCandidatureManuelle } from './manuelle'
import { supprimerCandidature } from './lecture'

test('creerCandidatureManuelle insère une offre manuelle puis la candidature', async () => {
  const inserts: { table: string; payload: any }[] = []
  const single = vi.fn().mockResolvedValue({ data: { id: 'offre-123' }, error: null })
  const client: any = {
    from: vi.fn((table: string) => ({
      insert: (payload: any) => {
        inserts.push({ table, payload })
        return { select: () => ({ single }), then: (res: any) => res({ error: null }) }
      },
    })),
  }

  const offreId = await creerCandidatureManuelle(client, 'u1', {
    titre: 'Diététicien', entreprise: 'Clinique', ville: 'Nantes', url: 'https://x.fr', dateIso: '2026-07-10',
  })

  expect(offreId).toBe('offre-123')
  const offreInsert = inserts.find((i) => i.table === 'offres')!.payload
  expect(offreInsert).toMatchObject({ source: 'manuelle', titre: 'Diététicien', entreprise: 'Clinique', ville: 'Nantes', url_postuler: 'https://x.fr' })
  expect(typeof offreInsert.source_id).toBe('string')
  const candInsert = inserts.find((i) => i.table === 'candidatures')!.payload
  expect(candInsert).toMatchObject({ user_id: 'u1', offre_id: 'offre-123', statut: 'postulee', postulee_le: '2026-07-10', relance_le: '2026-07-20' })
})

test('supprimerCandidature supprime l\'offre (et sa candidature via cascade) si offre manuelle', async () => {
  const deletes: string[] = []
  const single = vi.fn().mockResolvedValue({ data: { source: 'manuelle' }, error: null })
  const client: any = {
    from: vi.fn((table: string) => ({
      select: () => ({ eq: () => ({ single }) }),
      delete: () => {
        deletes.push(table)
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }), then: (r: any) => r({ error: null }) }), then: (r: any) => r({ error: null }) }
      },
    })),
  }

  await supprimerCandidature(client, 'u1', 'offre-123')
  expect(deletes).toEqual(['offres'])
  expect(deletes).not.toContain('candidatures')
})

test('supprimerCandidature supprime seulement la candidature si offre France Travail', async () => {
  const deletes: string[] = []
  const single = vi.fn().mockResolvedValue({ data: { source: 'france_travail' }, error: null })
  const client: any = {
    from: vi.fn((table: string) => ({
      select: () => ({ eq: () => ({ single }) }),
      delete: () => {
        deletes.push(table)
        return { eq: () => ({ eq: () => Promise.resolve({ error: null }), then: (r: any) => r({ error: null }) }), then: (r: any) => r({ error: null }) }
      },
    })),
  }

  await supprimerCandidature(client, 'u1', 'offre-456')
  expect(deletes).toEqual(['candidatures'])
  expect(deletes).not.toContain('offres')
})
