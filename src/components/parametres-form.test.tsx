import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import ParametresForm from './parametres-form'

const updateUser = vi.fn().mockResolvedValue({ error: null })
const signOut = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/client', () => ({
  getBrowserClient: () => ({ auth: { updateUser, signOut } }),
}))

test('affiche l\'email en lecture', () => {
  render(<ParametresForm email="a@b.c" />)
  expect(screen.getByText('a@b.c')).toBeInTheDocument()
})

test('affiche une erreur si les mots de passe ne correspondent pas', async () => {
  const user = userEvent.setup()
  render(<ParametresForm email="a@b.c" />)

  await user.type(screen.getByLabelText(/nouveau mot de passe/i), 'motdepasse1')
  await user.type(screen.getByLabelText(/confirmation/i), 'motdepasse2')
  await user.click(screen.getByRole('button', { name: /mettre à jour/i }))

  expect(await screen.findByText(/ne correspondent pas/i)).toBeInTheDocument()
  expect(updateUser).not.toHaveBeenCalled()
})

test('appelle updateUser quand les mots de passe correspondent', async () => {
  const user = userEvent.setup()
  render(<ParametresForm email="a@b.c" />)

  await user.type(screen.getByLabelText(/nouveau mot de passe/i), 'motdepasse1')
  await user.type(screen.getByLabelText(/confirmation/i), 'motdepasse1')
  await user.click(screen.getByRole('button', { name: /mettre à jour/i }))

  expect(updateUser).toHaveBeenCalledWith({ password: 'motdepasse1' })
  expect(await screen.findByText(/mis à jour/i)).toBeInTheDocument()
})
