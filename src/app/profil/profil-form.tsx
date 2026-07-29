'use client'
import { useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import { upsertProfil, uploadCv, uploadLettre, type Profil } from '@/lib/profil'

export default function ProfilForm({ initial }: { initial: Profil }) {
  const [form, setForm] = useState(initial)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const supabase = getBrowserClient()
      await upsertProfil(supabase, initial.user_id, {
        nom: form.nom, titre_recherche: form.titre_recherche,
      })
      setSaved(true)
    } catch {
      setError("Échec de l'enregistrement, réessayez.")
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <label htmlFor="nom" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Nom</label>
        <input id="nom" value={form.nom ?? ''} onChange={(e) => setForm({ ...form, nom: e.target.value })}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }} />
      </div>
      <div>
        <label htmlFor="titre" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Titre recherché</label>
        <input id="titre" value={form.titre_recherche ?? ''} onChange={(e) => setForm({ ...form, titre_recherche: e.target.value })}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }} />
      </div>
      <div>
        <label htmlFor="lettre" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Lettre de motivation de base (PDF)</label>
        <input id="lettre" type="file" accept="application/pdf"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setError(null)
            try {
              const supabase = getBrowserClient()
              const path = await uploadLettre(supabase, initial.user_id, file)
              setForm((prev) => ({ ...prev, lettre_url: path }))
              setSaved(true)
            } catch {
              setError("Échec de l'envoi de la lettre, réessayez.")
            }
          }}
          className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium file:cursor-pointer cursor-pointer"
          style={{ color: 'var(--muted)' }} />
        {form.lettre_url && <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>Lettre actuelle : {form.lettre_url}</p>}
      </div>
      <div>
        <label htmlFor="cv" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted)' }}>CV (PDF)</label>
        <input id="cv" type="file" accept="application/pdf"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setError(null)
            try {
              const supabase = getBrowserClient()
              const path = await uploadCv(supabase, initial.user_id, file)
              setForm((prev) => ({ ...prev, cv_url: path }))
              setSaved(true)
            } catch {
              setError("Échec de l'envoi du CV, réessayez.")
            }
          }}
          className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium file:cursor-pointer cursor-pointer"
          style={{ color: 'var(--muted)' }} />
        {form.cv_url && <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>CV actuel : {form.cv_url}</p>}
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="btn-primary">Enregistrer</button>
        {saved && <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Enregistré ✓</span>}
      </div>
      {error && <p className="text-sm mt-1" style={{ color: '#e2565b' }}>{error}</p>}
    </form>
  )
}
