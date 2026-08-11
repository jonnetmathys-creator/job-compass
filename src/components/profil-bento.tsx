'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { getBrowserClient } from '@/lib/supabase/client'
import { uploadCv, uploadLettre, type Profil } from '@/lib/profil'
import { enregistrerProfil } from '@/app/profil/actions'
import type { Alerte } from '@/lib/alertes/liste'
import PreferencesSelector from './preferences-selector'
import AlertesProfil from './alertes-profil'
import OnboardingRejouer from './onboarding-rejouer'

const IconUser = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
const IconStar = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.1 4.9 5.3.5-4 3.5 1.2 5.2L12 14.8 7.4 17.6l1.2-5.2-4-3.5 5.3-.5z" /></svg>
const IconDoc = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
const IconHeart = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>

// Extrait un nom de fichier lisible depuis un chemin storage (ex. "userid/cv.pdf" -> "cv.pdf").
const nomFichier = (path: string | null) => (path ? path.split('/').pop() ?? path : null)

export default function ProfilBento({ initial, alertes }: { initial: Profil; alertes: Alerte[] }) {
  const [nom, setNom] = useState(initial.nom ?? '')
  const [titre, setTitre] = useState(initial.titre_recherche ?? '')
  const [preferences, setPreferences] = useState<string[]>(initial.preferences ?? [])
  const [cvUrl, setCvUrl] = useState(initial.cv_url)
  const [lettreUrl, setLettreUrl] = useState(initial.lettre_url)
  const [saved, setSaved] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null); setSaved(false)
    startTransition(async () => {
      const res = await enregistrerProfil({ nom: nom.trim() || null, titre_recherche: titre.trim() || null, preferences })
      if (res.ok) setSaved(true)
      else setErreur(res.erreur ?? "Échec de l'enregistrement, réessayez.")
    })
  }

  async function envoyerCv(file: File) {
    setErreur(null)
    try { setCvUrl(await uploadCv(getBrowserClient(), initial.user_id, file)) }
    catch { setErreur("Échec de l'envoi du CV, réessayez.") }
  }
  async function envoyerLettre(file: File) {
    setErreur(null)
    try { setLettreUrl(await uploadLettre(getBrowserClient(), initial.user_id, file)) }
    catch { setErreur("Échec de l'envoi de la lettre, réessayez.") }
  }

  return (
    <form className="profil-bento" onSubmit={save}>
      {/* Identité */}
      <section className="p-tile p-id">
        <div className="p-tile-lbl"><IconUser />Identité</div>
        <label className="p-field-lbl" htmlFor="pb-nom">Nom</label>
        <input id="pb-nom" className="p-field" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Votre nom" />
        <label className="p-field-lbl" htmlFor="pb-titre">Titre recherché</label>
        <input id="pb-titre" className="p-field" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Diététicien" />
      </section>

      {/* Documents */}
      <section className="p-tile p-docs">
        <div className="p-tile-lbl"><IconDoc />Documents</div>
        <label className="p-doc">
          <span className="p-doc-ico"><IconDoc /></span>
          <span className="p-doc-txt"><b>CV</b><small>{nomFichier(cvUrl) ?? 'à ajouter'}</small></span>
          <span className="p-doc-action">{cvUrl ? 'Remplacer' : 'Ajouter'}</span>
          <input type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) envoyerCv(f) }} />
        </label>
        <label className="p-doc">
          <span className="p-doc-ico"><IconDoc /></span>
          <span className="p-doc-txt"><b>Lettre de motivation</b><small>{nomFichier(lettreUrl) ?? 'à ajouter'}</small></span>
          <span className="p-doc-action">{lettreUrl ? 'Remplacer' : 'Ajouter'}</span>
          <input type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) envoyerLettre(f) }} />
        </label>
      </section>

      {/* Préférences */}
      <section className="p-tile p-pref">
        <div className="p-tile-lbl"><IconStar />Préférences de poste</div>
        <p className="p-hint">Aident l&apos;IA à mieux noter vos offres. Cochez ce que vous recherchez.</p>
        <PreferencesSelector value={preferences} onChange={setPreferences} />
      </section>

      {/* Alertes email + rejouer le tutoriel */}
      <section className="p-tile p-alertes">
        <AlertesProfil alertes={alertes} />
        <div className="p-sep"><OnboardingRejouer /></div>
      </section>

      {/* Offres likées */}
      <Link href="/favoris" className="p-tile p-likes p-likes-link">
        <span className="p-doc-ico"><IconHeart /></span>
        <span className="p-doc-txt"><b>Mes offres likées</b><small>Retrouvez les offres sauvegardées</small></span>
        <svg className="p-likes-arr" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
      </Link>

      {/* Enregistrer */}
      <div className="p-save">
        {erreur && <span className="p-err">{erreur}</span>}
        {saved && !erreur && <span className="p-ok">Enregistré ✓</span>}
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}
