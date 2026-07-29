import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import PostulerToggle from './postuler-toggle'

const marquerPostulee = vi.fn().mockResolvedValue(undefined)
const retirerDuSuivi = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/suivi/actions', () => ({
  marquerPostulee: (...a: unknown[]) => marquerPostulee(...a),
  retirerDuSuivi: (...a: unknown[]) => retirerDuSuivi(...a),
}))

test('statut brouillon : bouton « J\'ai postulé », clic appelle marquerPostulee', async () => {
  const user = userEvent.setup()
  render(<PostulerToggle offreId="o1" statutInitial="brouillon" />)
  const btn = screen.getByRole('button', { name: /j'ai postulé/i })
  await user.click(btn)
  expect(marquerPostulee).toHaveBeenCalledWith('o1')
})

test('statut postulee : état « Postulé », lien vers le suivi, pas de bouton « J\'ai postulé »', () => {
  render(<PostulerToggle offreId="o1" statutInitial="postulee" />)
  expect(screen.getByText(/postulé/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /suivi/i })).toHaveAttribute('href', '/suivi')
  expect(screen.queryByRole('button', { name: /j'ai postulé/i })).toBeNull()
})
