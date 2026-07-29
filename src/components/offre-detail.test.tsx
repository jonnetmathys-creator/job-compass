import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import OffreDetail from './offre-detail'
import type { OffreRow } from '@/lib/offres/types'

vi.mock('@/lib/favoris/actions', () => ({ toggleFavori: vi.fn(async () => ({ liked: true })) }))

const offre: OffreRow = {
  id: '1', source: 'ft', source_id: '1', titre: 'Diététicien', entreprise: 'Clinique du Parc', entreprise_logo: null,
  description: 'Mission', contrat: 'CDI', salaire: '30 k€', latitude: 47, longitude: -1, ville: '44 - NANTES',
  url_postuler: 'https://ft/offre', email_contact: null, date_publication: '2026-01-01',
}

describe('OffreDetail', () => {
  test('affiche le titre, l’initiale employeur en repli, et un lien Postuler', () => {
    render(<OffreDetail offre={offre} likedInitial={false} />)
    expect(screen.getByRole('heading', { name: 'Diététicien' })).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument() // initiale de "Clinique…"
    expect(screen.getByRole('link', { name: /postuler/i })).toHaveAttribute('href', 'https://ft/offre')
  })

  test('affiche le logo employeur quand présent', () => {
    render(<OffreDetail offre={{ ...offre, entreprise_logo: 'https://x/logo.png' }} likedInitial={false} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://x/logo.png')
  })
})
