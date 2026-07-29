import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import AlerteMailToggle from './alerte-mail-toggle'

const basculerAlertesEmail = vi.fn().mockResolvedValue({ actif: true })
vi.mock('@/lib/alertes/actions', () => ({
  basculerAlertesEmail: (...a: unknown[]) => basculerAlertesEmail(...a),
}))

test('reflète l\'état inactif et bascule au clic', async () => {
  const user = userEvent.setup()
  render(<AlerteMailToggle rechercheId="r1" actifInitial={false} />)
  const btn = screen.getByRole('button', { name: /alertes mail/i })
  expect(btn).toHaveAttribute('aria-pressed', 'false')
  await user.click(btn)
  expect(basculerAlertesEmail).toHaveBeenCalledWith('r1')
})

test('reflète l\'état actif', () => {
  render(<AlerteMailToggle rechercheId="r1" actifInitial={true} />)
  expect(screen.getByRole('button', { name: /alertes mail/i })).toHaveAttribute('aria-pressed', 'true')
})
