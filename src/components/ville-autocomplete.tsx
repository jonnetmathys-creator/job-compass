'use client'
import { useEffect, useRef, useState } from 'react'
import { chercherCommunes } from '@/lib/geo/autocomplete'

type Commune = { label: string; insee: string; lat: number; lng: number }

export default function VilleAutocomplete(props: {
  value: string
  onChange: (v: string) => void
  onSelect?: (c: Commune) => void
  onValider: () => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [suggestions, setSuggestions] = useState<Commune[]>([])
  const conteneurRef = useRef<HTMLDivElement>(null)
  const requeteId = useRef(0)

  useEffect(() => {
    const onClickExterieur = (e: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', onClickExterieur)
    return () => document.removeEventListener('mousedown', onClickExterieur)
  }, [])

  useEffect(() => {
    const id = ++requeteId.current
    const timer = setTimeout(() => {
      chercherCommunes(props.value).then((r) => {
        if (id === requeteId.current) setSuggestions(r)
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [props.value])

  const selectionner = (c: Commune) => {
    props.onChange(c.label)
    props.onSelect?.(c)
    setOuvert(false)
    props.onValider()
  }

  return (
    <div ref={conteneurRef} style={{ position: 'relative' }}>
      <input
        value={props.value}
        onChange={(e) => { props.onChange(e.target.value); setOuvert(true) }}
        onFocus={() => setOuvert(true)}
        onBlur={() => props.onValider()}
        placeholder="Toute la France"
        aria-label="Lieu"
        autoComplete="off"
      />
      {ouvert && suggestions.length > 0 && (
        <div className="autocomplete-suggestions">
          {suggestions.map((c) => (
            <button
              key={c.insee}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectionner(c)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
