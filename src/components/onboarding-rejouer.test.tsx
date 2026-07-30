import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import OnboardingRejouer from './onboarding-rejouer'

const { reinit } = vi.hoisted(() => ({ reinit: vi.fn() }))
vi.mock('@/lib/onboarding/actions', () => ({ reinitialiserOnboarding: reinit }))

test('relance : pose les clés localStorage et appelle la réinitialisation', async () => {
  const assign = vi.fn()
  Object.defineProperty(window, 'location', { value: { assign, href: '' }, writable: true })
  render(<OnboardingRejouer />)
  fireEvent.click(screen.getByRole('button', { name: /Revoir le tutoriel/i }))
  expect(localStorage.getItem('jc_tour_relance')).toBe('1')
  expect(localStorage.getItem('jc_tour_index')).toBe('0')
  await waitFor(() => expect(reinit).toHaveBeenCalledOnce())
})
