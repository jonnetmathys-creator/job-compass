import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import OnboardingSpotlight, { type Rect } from './onboarding-spotlight'
import { ETAPES } from '@/lib/onboarding/etapes'

const rect: Rect = { top: 100, left: 100, width: 200, height: 40 }

test('affiche le titre, le texte et les boutons de l’étape', () => {
  render(<OnboardingSpotlight etape={ETAPES[1]} rect={rect} index={1} total={9} suivantLabel="Suivant"
    onPrecedent={() => {}} onSuivant={() => {}} onPasser={() => {}} />)
  expect(screen.getByText('Affine tes résultats')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Suivant' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Passer' })).toBeInTheDocument()
})

test('les boutons déclenchent les callbacks', () => {
  const onSuivant = vi.fn()
  const onPasser = vi.fn()
  render(<OnboardingSpotlight etape={ETAPES[1]} rect={rect} index={1} total={9} suivantLabel="Suivant"
    onPrecedent={() => {}} onSuivant={onSuivant} onPasser={onPasser} />)
  fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
  fireEvent.click(screen.getByRole('button', { name: 'Passer' }))
  expect(onSuivant).toHaveBeenCalledOnce()
  expect(onPasser).toHaveBeenCalledOnce()
})

test('en pause (rect null) propose seulement de passer', () => {
  render(<OnboardingSpotlight etape={ETAPES[6]} rect={null} index={6} total={9} suivantLabel="Suivant"
    onPrecedent={() => {}} onSuivant={() => {}} onPasser={() => {}} />)
  expect(screen.getByRole('button', { name: 'Passer le tutoriel' })).toBeInTheDocument()
})
