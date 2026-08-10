import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { appelerGroqJson } from './groq'

beforeEach(() => { process.env.GROQ_API_KEY = 'gk-test' })
afterEach(() => { delete process.env.GROQ_API_KEY })

function reponse(content: string, ok = true, status = 200) {
  return {
    ok, status,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  } as unknown as Response
}

test('appelle Groq avec le bon endpoint, la clé et le mode JSON', async () => {
  const fetchImpl = vi.fn(async () => reponse('{"notes":[]}'))
  await appelerGroqJson('mon prompt', { fetchImpl })
  const [url, init] = fetchImpl.mock.calls[0]
  expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
  expect((init as any).headers.Authorization).toBe('Bearer gk-test')
  const body = JSON.parse((init as any).body)
  expect(body.response_format).toEqual({ type: 'json_object' })
  expect(body.messages[0].content).toBe('mon prompt')
})

test('parse et renvoie le JSON', async () => {
  const fetchImpl = vi.fn(async () => reponse('{"notes":[{"ref":"a","score":88,"raison":"ok"}]}'))
  const out = await appelerGroqJson<{ notes: { ref: string; score: number }[] }>('p', { fetchImpl })
  expect(out.notes[0]).toEqual({ ref: 'a', score: 88, raison: 'ok' })
})

test('HTTP non ok -> lève', async () => {
  const fetchImpl = vi.fn(async () => reponse('quota', false, 429))
  await expect(appelerGroqJson('p', { fetchImpl })).rejects.toThrow(/HTTP 429/)
})

test('JSON malformé -> lève', async () => {
  const fetchImpl = vi.fn(async () => reponse('pas du json'))
  await expect(appelerGroqJson('p', { fetchImpl })).rejects.toThrow(/malformée/)
})
