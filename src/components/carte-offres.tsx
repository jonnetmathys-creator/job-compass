'use client'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { useEffect, useRef } from 'react'
import { positionEpingle } from '@/lib/geo/departements'
import type { OffreRow } from '@/lib/offres/types'

const PIN_SVG = '<svg width="28" height="38" viewBox="0 0 30 40" fill="currentColor"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 12.4 22.7 14.2 24.5a1.1 1.1 0 0 0 1.6 0C17.6 37.7 30 25.5 30 15 30 6.7 23.3 0 15 0Z" stroke="#fff" stroke-width="2.5"/><circle cx="15" cy="15" r="5.4" fill="#fff"/></svg>'

// Échappe une valeur avant interpolation dans du HTML (les données proviennent de France
// Travail, source tierce non fiable, et sont injectées via bindPopup(string)).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function pointsFor(offres: OffreRow[]) {
  return offres
    .map((o) => {
      const p = positionEpingle(o)
      return p ? { id: o.id, lat: p.lat, lng: p.lng, offre: o } : null
    })
    .filter(Boolean) as { id: string; lat: number; lng: number; offre: OffreRow }[]
}

export default function CarteOffres(props: {
  offres: OffreRow[]; hoveredId: string | null; expandedId: string | null
  onHover: (id: string | null) => void; onSelect: (id: string) => void
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const clusterRef = useRef<any>(null)
  const selectRef = useRef(props.onSelect); selectRef.current = props.onSelect
  const hoverRef = useRef(props.onHover); hoverRef.current = props.onHover

  // init + (re)construit les marqueurs quand la liste d'offres change
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const Lmod = await import('leaflet')
      const L = ((Lmod as any).default ?? Lmod) as typeof import('leaflet')
      await import('leaflet.markercluster')
      // Importé AVANT la section critique : plus aucun await entre la création de
      // la carte, l'ajout du fond et celui des marqueurs (sinon, quand l'effet se
      // relance, deux exécutions se chevauchent sur l'await et les pins sautent).
      const { fondProtomaps } = await import('@/lib/carte-theme')
      if (cancelled || !elRef.current) return
      if (!mapRef.current) {
        // maxZoom fini OBLIGATOIRE : markercluster s'appuie sur map.getMaxZoom()
        // pour construire ses clusters. Le fond vectoriel Protomaps n'en impose
        // pas (sur-zoomable), donc sans ça getMaxZoom() = Infinity et aucun pin
        // ne s'affiche. On le pose sur la carte, indépendamment du fond.
        mapRef.current = L.map(elRef.current, { zoomControl: true, maxZoom: 19 }).setView([47.35, -1.2], 6)
        // Fond de carte : Protomaps vectoriel stylé à la charte JobCompass si une
        // clé est configurée, sinon (ou en cas d'erreur) repli sur Esri Light Gray.
        // Le try/catch garantit que les marqueurs sont ajoutés quoi qu'il arrive.
        const esriFond = () => {
          const o = { maxZoom: 20, maxNativeZoom: 16 }
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            ...o, attribution: 'Tiles © Esri — Esri, HERE, Garmin, © contributeurs OpenStreetMap',
          }).addTo(mapRef.current!)
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', o).addTo(mapRef.current!)
        }
        try {
          const famille = getComputedStyle(document.body).fontFamily
          const fond = fondProtomaps(famille)
          if (fond) fond.addTo(mapRef.current)
          else esriFond()
        } catch (e) {
          console.error('[carte] fond Protomaps KO, repli Esri :', e)
          esriFond()
        }
      }
      if (clusterRef.current) mapRef.current.removeLayer(clusterRef.current)
      markersRef.current = {}
      clusterRef.current = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 48,
        iconCreateFunction: (c: any) =>
          L.divIcon({ html: `<div class="cluster-pin">${c.getChildCount()}</div>`, className: '', iconSize: [42, 42] }),
      })
      for (const pt of pointsFor(props.offres)) {
        const icon = L.divIcon({ className: '', html: `<div class="pin">${PIN_SVG}</div>`, iconSize: [28, 38], iconAnchor: [14, 38] })
        const m = L.marker([pt.lat, pt.lng], { icon })
        const o = pt.offre
        const sal = o.salaire ? `<span class="mp-s">${escapeHtml(o.salaire)}</span>` : '<span></span>'
        // La bulle EST un lien : un vrai <a href> navigue de façon fiable (l'ancien
        // listener sur popupopen ratait parfois car getElement() n'était pas prêt).
        m.bindPopup(
          `<a class="mp-link" href="/offre/${escapeHtml(o.id)}"><div class="mp-t">${escapeHtml(o.titre)}</div><div class="mp-e">${escapeHtml(o.entreprise ?? '')}${o.ville ? ' · ' + escapeHtml(o.ville) : ''}</div><div class="mp-foot">${sal}<span class="mp-go">Voir l'offre <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span></div></a>`,
          { closeButton: false, offset: [0, -30] },
        )
        m.on('click', () => {
          selectRef.current(o.id)
          if (clusterRef.current.zoomToShowLayer) clusterRef.current.zoomToShowLayer(m, () => m.openPopup())
          else m.openPopup()
        })
        m.on('mouseover', () => hoverRef.current(o.id))
        m.on('mouseout', () => hoverRef.current(null))
        markersRef.current[o.id] = m
        clusterRef.current.addLayer(m)
      }
      mapRef.current.addLayer(clusterRef.current)
      mapRef.current.invalidateSize()
    })()
    return () => {
      cancelled = true
    }
  }, [props.offres])

  // survol synchronisé liste -> épingle
  useEffect(() => {
    for (const [id, m] of Object.entries(markersRef.current)) {
      const pin = (m as any)._icon?.querySelector('.pin')
      if (pin) pin.classList.toggle('active', id === props.hoveredId)
    }
  }, [props.hoveredId])

  // clic sur une offre à gauche -> zoom carte + épingle en évidence
  useEffect(() => {
    try {
      for (const m of Object.values(markersRef.current)) {
        ;(m as any)._icon?.querySelector('.pin')?.classList.remove('active')
      }
      const id = props.expandedId
      if (!id) return
      const m = markersRef.current[id]
      if (!m || !mapRef.current) return
      const ll = m.getLatLng()
      // Déplacement fluide (vol animé) jusqu'à l'épingle, puis ouverture de la bulle.
      const carte = mapRef.current
      carte.flyTo(ll, 12, { duration: 0.8 })
      carte.once('moveend', () => {
        try {
          if (clusterRef.current?.zoomToShowLayer) clusterRef.current.zoomToShowLayer(m, () => m.openPopup())
          else m.openPopup()
        } catch { /* marqueur pas prêt : on ignore */ }
      })
      m._icon?.querySelector('.pin')?.classList.add('active')
    } catch {
      // jsdom ou marqueur pas encore prêt : on ignore
    }
  }, [props.expandedId])

  // nettoyage au démontage : détruit la carte Leaflet (listeners window, tuiles, timers)
  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      clusterRef.current = null
      markersRef.current = {}
    }
  }, [])

  return <div ref={elRef} id="map" style={{ position: 'absolute', inset: 0 }} />
}
