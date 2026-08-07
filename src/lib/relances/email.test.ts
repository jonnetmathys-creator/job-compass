import { expect, test } from 'vitest'
import { buildRelanceEmailHtml, sujetRelance } from './email'

test('sujetRelance : singulier / pluriel', () => {
  expect(sujetRelance([{}])).toContain('Une candidature')
  expect(sujetRelance([{}, {}])).toContain('2 candidatures')
})

test('buildRelanceEmailHtml liste les offres et pointe vers le suivi', () => {
  const html = buildRelanceEmailHtml(
    [{ id: 'o1', titre: 'Diététicien H/F', entreprise: 'Clinique', ville: 'Nantes' }],
    'https://app.test',
  )
  expect(html).toContain('Diététicien H/F')
  expect(html).toContain('Clinique · Nantes')
  expect(html).toContain('https://app.test/suivi')
})
