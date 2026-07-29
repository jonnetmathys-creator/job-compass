import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import ResultatsShell from './resultats-shell'
import type { OffreRow } from '@/lib/offres/types'

vi.mock('@/lib/recherche/actions', () => ({ affinerLieu: vi.fn() }))
vi.mock('@/lib/favoris/actions', () => ({ toggleFavori: vi.fn(async () => ({ liked: true })) }))
vi.mock('./carte-offres', () => ({ default: () => <div data-testid="carte" /> }))

const o = (id: string, contrat: string): OffreRow => ({
  id, source: 'ft', source_id: id, titre: `Offre ${id}`, entreprise: 'E', entreprise_logo: null,
  description: 'desc', contrat, salaire: null, latitude: 47, longitude: -1, ville: '44 - NANTES',
  url_postuler: null, email_contact: null, date_publication: '2026-01-01',
})

test('le filtre contrat masque les offres non concernées', async () => {
  render(<ResultatsShell recherche={{ id: 'r1', intitule: 'Diét', localisation: null, rayon_km: null, lieu_label: null }}
    offres={[o('1', 'CDI'), o('2', 'CDD')]} favoriIds={[]} />)
  expect(screen.getByText('Offre 1')).toBeInTheDocument()
  expect(screen.getByText('Offre 2')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText(/type de contrat/i), 'CDI')
  expect(screen.getByText('Offre 1')).toBeInTheDocument()
  expect(screen.queryByText('Offre 2')).not.toBeInTheDocument()
})
