'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { lancerRecherche } from '@/lib/recherche/actions'
import MetierAutocomplete from './metier-autocomplete'
import LoadingOverlay from './loading-overlay'

const PHRASES = [
  'Quel *poste* recherchez-vous ?',
  'Quelle sera votre prochaine *mission* ?',
  'Trouvons votre prochain *poste*.',
  'Prêt·e pour un nouveau *chapitre* ?',
]
const RECHERCHE_MSGS = [
  'Exploration des offres…',
  'Analyse des postes disponibles…',
  'Localisation sur la carte…',
  'On y est presque…',
]
export default function SearchBar() {
  const [poste, setPoste] = useState('')
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const [pending, startTransition] = useTransition()

  // titre tournant mot par mot
  useEffect(() => {
    let pi = 0
    const el = headlineRef.current
    if (!el) return
    const render = (text: string) => {
      el.innerHTML = text.split(' ').map((w, i) => {
        const em = w.includes('*'); const clean = w.replace(/\*/g, '')
        return `<span class="word${em ? ' accent' : ''}" style="transition-delay:${i * 75}ms">${clean}</span>`
      }).join(' ')
      requestAnimationFrame(() => requestAnimationFrame(() =>
        el.querySelectorAll('.word').forEach((s) => s.classList.add('show'))))
    }
    render(PHRASES[0])
    let swap: ReturnType<typeof setTimeout>
    const id = setInterval(() => {
      const words = el.querySelectorAll('.word')
      words.forEach((s, i) => { (s as HTMLElement).style.transitionDelay = `${i * 35}ms`; s.classList.remove('show'); s.classList.add('out') })
      swap = setTimeout(() => { pi = (pi + 1) % PHRASES.length; render(PHRASES[pi]) }, 300 + words.length * 35)
    }, 4400)
    return () => { clearInterval(id); clearTimeout(swap) }
  }, [])

  return (
    <div className="hero">
      <Link href="/" className="logo" aria-label="Retour à la recherche">Job<span>Compass</span></Link>
      <div className="headline"><h1 ref={headlineRef} /></div>
      <form className="searchbar" data-tour="recherche" onSubmit={(e) => { e.preventDefault(); if (poste.trim()) startTransition(() => lancerRecherche(poste)) }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <MetierAutocomplete
          value={poste}
          onChange={setPoste}
          onSubmit={() => poste.trim() && startTransition(() => lancerRecherche(poste))}
          placeholder="Diététicien, nutritionniste..."
        />
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Recherche…' : 'Rechercher'}</button>
      </form>
      {pending && <LoadingOverlay messages={RECHERCHE_MSGS} />}
    </div>
  )
}
