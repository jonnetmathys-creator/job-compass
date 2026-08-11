'use client'
import { PREFERENCES } from '@/lib/preferences'

// Sélecteur de préférences en chips (toggle). Piloté : reçoit les clés cochées et
// notifie chaque changement. Groupé par thème (cadre d'exercice, contrat, etc.).
export default function PreferencesSelector({
  value, onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const set = new Set(value)
  function toggle(cle: string) {
    const next = new Set(set)
    if (next.has(cle)) next.delete(cle)
    else next.add(cle)
    onChange([...next])
  }
  return (
    <div className="pref-groups">
      {PREFERENCES.map((groupe) => (
        <div key={groupe.titre} className="pref-group">
          <div className="pref-subhead">{groupe.titre}</div>
          <div className="pref-chips">
            {groupe.options.map((o) => {
              const actif = set.has(o.cle)
              return (
                <button
                  key={o.cle}
                  type="button"
                  className={`pref-chip${actif ? ' on' : ''}`}
                  aria-pressed={actif}
                  onClick={() => toggle(o.cle)}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
