import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import SearchBar from './search-bar'

vi.mock('@/lib/recherche/actions', () => ({ lancerRecherche: vi.fn() }))

test('affiche la barre de recherche et un titre', () => {
  render(<SearchBar />)
  expect(screen.getByRole('textbox')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /rechercher/i })).toBeInTheDocument()
})
