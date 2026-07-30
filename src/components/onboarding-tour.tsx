'use client'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'
import { estOnboardingTermine } from '@/lib/onboarding/lecture'
import { terminerOnboarding } from '@/lib/onboarding/actions'
import { lancerRecherche } from '@/lib/recherche/actions'
import { ETAPES, etapeSuivante, etapePrecedente, estDerniere, pageCorrespond } from '@/lib/onboarding/etapes'
import OnboardingSpotlight, { type Rect } from './onboarding-spotlight'
import LoadingOverlay from './loading-overlay'

const CLE_INDEX = 'jc_tour_index'
const CLE_RELANCE = 'jc_tour_relance'
const CHARGEMENT_MSGS = ['Exploration des offres…', 'Analyse des postes…', 'Localisation sur la carte…', 'On y est presque…']

export default function OnboardingTour() {
  const pathname = usePathname()
  const router = useRouter()
  const [actif, setActif] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [chargement, setChargement] = useState(false)
  const [, demarrerTransition] = useTransition()
  const verifie = useRef(false)

  // Démarrage : première page hors login/signup, on lit le flag (ou une relance locale).
  useEffect(() => {
    if (verifie.current) return
    if (pathname === '/login' || pathname === '/signup') return
    verifie.current = true
    let annule = false
    const client = getBrowserClient()
    ;(async () => {
      const relance = typeof window !== 'undefined' && localStorage.getItem(CLE_RELANCE) === '1'
      const { data: { user } } = await client.auth.getUser()
      if (!user || annule) return
      const termine = await estOnboardingTermine(client, user.id)
      if (annule) return
      if (relance || !termine) {
        const brut = Number(localStorage.getItem(CLE_INDEX) ?? '0')
        const idx = relance || !Number.isFinite(brut) ? 0 : Math.min(Math.max(brut, 0), ETAPES.length - 1)
        localStorage.removeItem(CLE_RELANCE)
        setIndex(idx)
        setActif(true)
      }
    })()
    return () => { annule = true }
  }, [pathname])

  // Persiste l'index pour survivre aux navigations/reloads en cours de visite.
  useEffect(() => { if (actif) localStorage.setItem(CLE_INDEX, String(index)) }, [actif, index])

  // L'overlay de chargement ne dure que le temps de la collecte : la redirection le referme.
  useEffect(() => { setChargement(false) }, [pathname])

  // Localise la cible de l'étape courante et suit ses mouvements (scroll/resize).
  useEffect(() => {
    if (!actif) { setRect(null); return }
    const etape = ETAPES[index]
    if (!pageCorrespond(etape, pathname)) { setRect(null); return }
    let annule = false
    let essais = 0
    const maj = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    const trouver = () => {
      if (annule) return
      const el = document.querySelector(etape.cible) as HTMLElement | null
      if (el) {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }) } catch { /* jsdom */ }
        maj(el); return
      }
      if (essais++ < 20) setTimeout(trouver, 100) // ~2 s puis pause
    }
    const suivre = () => {
      const el = document.querySelector(etape.cible) as HTMLElement | null
      if (el) maj(el)
    }
    trouver()
    window.addEventListener('scroll', suivre, true)
    window.addEventListener('resize', suivre)
    return () => { annule = true; window.removeEventListener('scroll', suivre, true); window.removeEventListener('resize', suivre) }
  }, [actif, index, pathname])

  const finir = useCallback(() => {
    setActif(false); setRect(null); setChargement(false)
    if (typeof window !== 'undefined') localStorage.removeItem(CLE_INDEX)
    terminerOnboarding().catch(() => {})
  }, [])

  const suivant = useCallback(() => {
    const etape = ETAPES[index]
    if (estDerniere(index, ETAPES.length)) { finir(); return }
    if (etape.action === 'recherche') {
      setIndex((i) => etapeSuivante(i, ETAPES.length))
      setChargement(true)
      demarrerTransition(() => { lancerRecherche('Diététicien').catch(() => setChargement(false)) })
      return
    }
    if (etape.action === 'offre') {
      const carte = document.querySelector('[data-offre-id]') as HTMLElement | null
      const id = carte?.dataset.offreId
      if (id) { setIndex((i) => etapeSuivante(i, ETAPES.length)); router.push(`/offre/${id}`) }
      else { setIndex(ETAPES.length - 1) } // aucune offre : saute à l'étape « compte »
      return
    }
    setIndex((i) => etapeSuivante(i, ETAPES.length))
  }, [index, finir, router])

  const precedent = useCallback(() => setIndex((i) => etapePrecedente(i)), [])

  if (!actif || pathname === '/login' || pathname === '/signup') return null
  return (
    <>
      {chargement && <LoadingOverlay messages={CHARGEMENT_MSGS} />}
      <OnboardingSpotlight
        etape={ETAPES[index]} rect={rect} index={index} total={ETAPES.length}
        suivantLabel={estDerniere(index, ETAPES.length) ? 'Terminer' : 'Suivant'}
        onPrecedent={precedent} onSuivant={suivant} onPasser={finir}
      />
    </>
  )
}
