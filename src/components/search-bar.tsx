'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { lancerRecherche } from '@/lib/recherche/actions'

const PHRASES = [
  'Quel *poste* recherchez-vous ?',
  'Quelle sera votre prochaine *mission* ?',
  'Trouvons votre prochain *poste*.',
  'Prêt·e pour un nouveau *chapitre* ?',
]
const JOBS = ['Diététicien', 'Nutritionniste', 'Conseiller en nutrition', 'Diététicien hospitalier', 'Nutrithérapeute']

export default function SearchBar() {
  const [poste, setPoste] = useState('')
  const [placeholder, setPlaceholder] = useState('Diététicien')
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

  // placeholder machine à écrire
  useEffect(() => {
    let ji = 0, ci = 0, del = false, timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const w = JOBS[ji]
      setPlaceholder(w.slice(0, ci))
      if (!del) { ci++; if (ci > w.length) { del = true; timer = setTimeout(tick, 1300); return } }
      else { ci--; if (ci === 0) { del = false; ji = (ji + 1) % JOBS.length } }
      timer = setTimeout(tick, del ? 45 : 85)
    }
    timer = setTimeout(tick, 600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="hero">
      <div className="logo" style={{ fontSize: 27, marginBottom: 34 }}>Job<span>Compass</span></div>
      <div className="headline"><h1 ref={headlineRef} /></div>
      <form className="searchbar" onSubmit={(e) => { e.preventDefault(); if (poste.trim()) startTransition(() => lancerRecherche(poste)) }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input value={poste} onChange={(e) => setPoste(e.target.value)} placeholder={placeholder} aria-label="Poste recherché" />
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Recherche…' : 'Rechercher'}</button>
      </form>
    </div>
  )
}
