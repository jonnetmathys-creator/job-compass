import { expect, test, vi } from 'vitest'
import { rafraichirEtEnregistrer, envoyerAlerteSiActive } from './refresh'

test('rafraichirEtEnregistrer détecte et enregistre (sans email)', async () => {
  const client = {} as any
  const rafraichir = vi.fn().mockResolvedValue({ nouvelles: ['c', 'd'] })
  const enregistrer = vi.fn().mockResolvedValue(2)
  const recherche = { id: 'r1', user_id: 'u1', mots_cles: ['x'], localisation: null, rayon_km: null, type_contrat: null, alertes_email: true }

  const out = await rafraichirEtEnregistrer(client, recherche as any, { rafraichir, enregistrer })

  expect(enregistrer).toHaveBeenCalledWith(client, 'u1', 'r1', ['c', 'd'])
  expect(out).toEqual({ nouvelles: 2, ids: ['c', 'd'] })
})

test('envoyerAlerteSiActive envoie si opt-in et ids non vides', async () => {
  const envoyer = vi.fn().mockResolvedValue(true)
  const client = { auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'a@b.fr' } } }) } } } as any
  const recherche = { id: 'r1', user_id: 'u1', intitule: 'X', alertes_email: true } as any
  const ok = await envoyerAlerteSiActive(client, recherche, ['c', 'd'], { envoyer })
  expect(envoyer).toHaveBeenCalledTimes(1)
  expect(envoyer.mock.calls[0][0]).toMatchObject({ to: 'a@b.fr', offreIds: ['c', 'd'] })
  expect(ok).toBe(true)
})

test('envoyerAlerteSiActive n\'envoie pas si opt-out ou aucune offre', async () => {
  const envoyer = vi.fn()
  const client = {} as any
  expect(await envoyerAlerteSiActive(client, { alertes_email: false } as any, ['c'], { envoyer })).toBe(false)
  expect(await envoyerAlerteSiActive(client, { alertes_email: true } as any, [], { envoyer })).toBe(false)
  expect(envoyer).not.toHaveBeenCalled()
})
