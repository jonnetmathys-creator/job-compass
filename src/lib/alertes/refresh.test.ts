import { expect, test, vi } from 'vitest'
import { rafraichirEtEnregistrer } from './refresh'

test('rafraichirEtEnregistrer détecte, enregistre et déclenche l\'email si opt-in', async () => {
  const client = {} as any
  const rafraichir = vi.fn().mockResolvedValue({ nouvelles: ['c', 'd'] })
  const enregistrer = vi.fn().mockResolvedValue(2)
  const envoyer = vi.fn().mockResolvedValue(true)
  const recherche = { id: 'r1', user_id: 'u1', mots_cles: ['x'], localisation: null, rayon_km: null, type_contrat: null, alertes_email: true }

  const out = await rafraichirEtEnregistrer(client, recherche as any, { rafraichir, enregistrer, envoyer })

  expect(rafraichir).toHaveBeenCalledTimes(1)
  expect(enregistrer).toHaveBeenCalledWith(client, 'u1', 'r1', ['c', 'd'])
  expect(envoyer).toHaveBeenCalledTimes(1)
  expect(out).toMatchObject({ nouvelles: 2, email: true })
})

test('pas d\'email si alertes_email est faux', async () => {
  const client = {} as any
  const rafraichir = vi.fn().mockResolvedValue({ nouvelles: ['c'] })
  const enregistrer = vi.fn().mockResolvedValue(1)
  const envoyer = vi.fn()
  const recherche = { id: 'r1', user_id: 'u1', mots_cles: [], localisation: null, rayon_km: null, type_contrat: null, alertes_email: false }

  const out = await rafraichirEtEnregistrer(client, recherche as any, { rafraichir, enregistrer, envoyer })
  expect(envoyer).not.toHaveBeenCalled()
  expect(out).toMatchObject({ nouvelles: 1, email: false })
})
