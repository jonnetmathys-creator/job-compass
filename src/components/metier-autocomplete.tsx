'use client'
import { useEffect, useRef, useState } from 'react'
import { METIERS_DIETETIQUE } from '@/lib/geo/autocomplete'

export default function MetierAutocomplete(props: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder?: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const conteneurRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickExterieur = (e: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', onClickExterieur)
    return () => document.removeEventListener('mousedown', onClickExterieur)
  }, [])

  const suggestions = METIERS_DIETETIQUE.filter((m) =>
    m.toLowerCase().includes(props.value.trim().toLowerCase()),
  )

  return (
    <div ref={conteneurRef} style={{ position: 'relative', flex: 1 }}>
      <input
        value={props.value}
        onChange={(e) => { props.onChange(e.target.value); setOuvert(true) }}
        onFocus={() => setOuvert(true)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setOuvert(false); props.onSubmit() } }}
        placeholder={props.placeholder}
        aria-label="Poste recherché"
        autoComplete="off"
        style={{ width: '100%', boxSizing: 'border-box' }}
      />
      {ouvert && suggestions.length > 0 && (
        <div className="autocomplete-suggestions">
          {suggestions.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { props.onChange(m); setOuvert(false) }}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
