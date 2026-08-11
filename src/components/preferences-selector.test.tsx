import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import PreferencesSelector from './preferences-selector'

test('cliquer une chip l\'active et rappelle onChange avec sa clé', async () => {
  const onChange = vi.fn()
  render(<PreferencesSelector value={[]} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'CDI' }))
  expect(onChange).toHaveBeenCalledWith(['cdi'])
})

test('recliquer une chip active la retire', async () => {
  const onChange = vi.fn()
  render(<PreferencesSelector value={['cdi']} onChange={onChange} />)
  const chip = screen.getByRole('button', { name: 'CDI' })
  expect(chip).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(chip)
  expect(onChange).toHaveBeenCalledWith([])
})
