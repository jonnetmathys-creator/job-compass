import { positionEpingle } from './departements'
import type { OffreRow } from '@/lib/offres/types'

const R = 6371 // rayon terrestre km
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function filtrerDansRayon(offres: OffreRow[], centre: { lat: number; lng: number }, rayonKm: number): OffreRow[] {
  return offres.filter((o) => {
    const p = positionEpingle(o)
    return p ? distanceKm(centre, p) <= rayonKm : false
  })
}
