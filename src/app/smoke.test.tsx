import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Home from './page'

test('la page d’accueil affiche le nom du produit', () => {
  render(<Home />)
  expect(screen.getByRole('heading', { name: /JobCompass/i })).toBeInTheDocument()
})
