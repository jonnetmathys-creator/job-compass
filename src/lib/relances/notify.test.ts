import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { notifierRelances } from './notify'

beforeEach(() => { process.env.GMAIL_USER = 'jc@gmail.com'; process.env.GMAIL_APP_PASSWORD = 'app-pass' })
afterEach(() => { delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD })

// Client mocké : select() renvoie `rows` ; update() capture les appels .in().
function clientAvec(rows: unknown[]) {
  const inSpy = vi.fn().mockResolvedValue({ error: null })
  const eqUpd = vi.fn(() => ({ in: inSpy }))
  const update = vi.fn(() => ({ eq: eqUpd }))
  const is = vi.fn().mockResolvedValue({ data: rows, error: null })
  const lte = vi.fn(() => ({ is }))
  const not = vi.fn(() => ({ lte }))
  const eqSel = vi.fn(() => ({ not }))
  const select = vi.fn(() => ({ eq: eqSel }))
  const from = vi.fn(() => ({ select, update }))
  return { client: { from } as any, spies: { from, select, is, update, inSpy } }
}

test('sans compte Gmail : ne fait rien', async () => {
  delete process.env.GMAIL_USER
  const { client } = clientAvec([])
  const envoi = vi.fn()
  expect(await notifierRelances(client, { envoi })).toBe(0)
  expect(envoi).not.toHaveBeenCalled()
})

test('groupe par utilisateur, envoie un email par user et marque notifiées', async () => {
  const rows = [
    { user_id: 'u1', offre_id: 'o1', offres: { id: 'o1', titre: 'Diét A', entreprise: 'CH', ville: 'Nantes' } },
    { user_id: 'u1', offre_id: 'o2', offres: { id: 'o2', titre: 'Diét B', entreprise: null, ville: null } },
    { user_id: 'u2', offre_id: 'o3', offres: { id: 'o3', titre: 'Diét C', entreprise: 'Clinique', ville: 'Rennes' } },
  ]
  const { client, spies } = clientAvec(rows)
  const envoi = vi.fn().mockResolvedValue(true)
  const emailDe = vi.fn(async (_c: unknown, id: string) => `${id}@test.fr`)

  const n = await notifierRelances(client, { envoi, emailDe, today: '2026-08-07' })

  expect(n).toBe(2) // un email pour u1 (2 offres), un pour u2
  const msgU1 = envoi.mock.calls.find((c) => c[0].to === 'u1@test.fr')![0]
  expect(msgU1.subject).toContain('2 candidatures')
  expect(msgU1.html).toContain('Diét A')
  expect(msgU1.html).toContain('Diét B')
  // marquage : update().eq().in() appelé avec les offreIds groupés de u1
  expect(spies.inSpy).toHaveBeenCalledWith('offre_id', ['o1', 'o2'])
})

test('utilisateur sans email : pas d\'envoi, pas de marquage', async () => {
  const rows = [{ user_id: 'u1', offre_id: 'o1', offres: { id: 'o1', titre: 'X', entreprise: null, ville: null } }]
  const { client, spies } = clientAvec(rows)
  const envoi = vi.fn().mockResolvedValue(true)
  const emailDe = vi.fn(async () => null)
  const n = await notifierRelances(client, { envoi, emailDe, today: '2026-08-07' })
  expect(n).toBe(0)
  expect(envoi).not.toHaveBeenCalled()
  expect(spies.inSpy).not.toHaveBeenCalled()
})

test('envoi en échec : pas de marquage (retentera plus tard)', async () => {
  const rows = [{ user_id: 'u1', offre_id: 'o1', offres: { id: 'o1', titre: 'X', entreprise: null, ville: null } }]
  const { client, spies } = clientAvec(rows)
  const envoi = vi.fn().mockResolvedValue(false)
  const emailDe = vi.fn(async () => 'u1@test.fr')
  const n = await notifierRelances(client, { envoi, emailDe, today: '2026-08-07' })
  expect(n).toBe(0)
  expect(spies.inSpy).not.toHaveBeenCalled()
})
