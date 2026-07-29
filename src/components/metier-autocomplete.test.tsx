import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import MetierAutocomplete from './metier-autocomplete'

test('propose des métiers filtrés et sélectionne au clic', async () => {
  const onChange = vi.fn()
  render(<MetierAutocomplete value="" onChange={onChange} onSubmit={vi.fn()} />)

  const input = screen.getByRole('textbox')
  await userEvent.type(input, 'diét')

  const suggestion = await screen.findByText('Diététicien')
  expect(suggestion).toBeInTheDocument()

  await userEvent.click(suggestion)
  expect(onChange).toHaveBeenCalledWith('Diététicien')
})

test('Entrée déclenche onSubmit', async () => {
  const onSubmit = vi.fn()
  render(<MetierAutocomplete value="Diététicien" onChange={vi.fn()} onSubmit={onSubmit} />)

  const input = screen.getByRole('textbox')
  await userEvent.click(input)
  await userEvent.keyboard('{Enter}')
  expect(onSubmit).toHaveBeenCalled()
})
