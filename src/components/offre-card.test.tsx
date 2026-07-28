import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import OffreCard from './offre-card'
import type { OffreRow } from '@/lib/offres/types'

const offre: OffreRow = {
  id: '1', source: 'ft', source_id: '1', titre: 'Diététicien', entreprise: 'Clinique', entreprise_logo: null,
  description: 'Belle mission', contrat: 'CDI', salaire: '30 k€', latitude: 47, longitude: -1, ville: '44 - NANTES',
  url_postuler: 'https://x', email_contact: null, date_publication: '2026-01-01',
}

test('affiche titre, employeur, étiquettes ; déroule au clic', async () => {
  const onExpand = vi.fn()
  render(<OffreCard offre={offre} expanded={false} liked={false} hovered={false}
    onToggleExpand={onExpand} onOpen={vi.fn()} onToggleLike={vi.fn()} onHover={vi.fn()} />)
  expect(screen.getByText('Diététicien')).toBeInTheDocument()
  expect(screen.getByText('CDI')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Diététicien'))
  expect(onExpand).toHaveBeenCalled()
})

test('le cœur déclenche onToggleLike sans dérouler', async () => {
  const onExpand = vi.fn(); const onLike = vi.fn()
  render(<OffreCard offre={offre} expanded liked={false} hovered={false}
    onToggleExpand={onExpand} onOpen={vi.fn()} onToggleLike={onLike} onHover={vi.fn()} />)
  await userEvent.click(screen.getByLabelText(/aimer/i))
  expect(onLike).toHaveBeenCalled()
  expect(onExpand).not.toHaveBeenCalled()
})
