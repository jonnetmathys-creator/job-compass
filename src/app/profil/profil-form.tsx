'use client'
import { useState } from 'react'
import { getBrowserClient } from '@/lib/supabase/client'
import { upsertProfil, uploadCv, type Profil } from '@/lib/profil'

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
        nom: form.nom, titre_recherche: form.titre_recherche, lettre_base: form.lettre_base,
      })
      setSaved(true)
    } catch {
      setError("Échec de l'enregistrement, réessayez.")
    }
  }

  return (
    <form onSubmit={save} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="nom" className="block text-sm mb-1">Nom</label>
        <input id="nom" value={form.nom ?? ''} onChange={(e) => setForm({ ...form, nom: e.target.value })}
          className="w-full rounded-xl border px-3 py-2" />
      </div>
      <div>
        <label htmlFor="titre" className="block text-sm mb-1">Titre recherché</label>
        <input id="titre" value={form.titre_recherche ?? ''} onChange={(e) => setForm({ ...form, titre_recherche: e.target.value })}
          className="w-full rounded-xl border px-3 py-2" />
      </div>
      <div>
        <label htmlFor="lettre" className="block text-sm mb-1">Lettre de motivation de base</label>
        <textarea id="lettre" rows={8} value={form.lettre_base ?? ''} onChange={(e) => setForm({ ...form, lettre_base: e.target.value })}
          className="w-full rounded-xl border px-3 py-2" />
      </div>
      <div>
        <label htmlFor="cv" className="block text-sm mb-1">CV (PDF)</label>
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
          className="w-full text-sm" />
        {form.cv_url && <p className="text-xs mt-1 text-gray-500">CV actuel : {form.cv_url}</p>}
      </div>
      <button type="submit" className="rounded-xl px-4 py-2 text-white font-medium" style={{ background: 'var(--accent)' }}>
        Enregistrer
      </button>
      {saved && <span className="ml-3 text-sm" style={{ color: 'var(--accent)' }}>Enregistré ✓</span>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </form>
  )
}
