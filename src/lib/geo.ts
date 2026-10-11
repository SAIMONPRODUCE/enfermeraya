import type { LatLng } from '../types'

const R = 6371

const rad = (d: number) => (d * Math.PI) / 180

/** Distancia Haversine en km */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const KM_PER_DEG_LAT = 111.32
export const kmPerDegLng = (lat: number) => 111.32 * Math.cos(rad(lat))

export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`)
export const etaMinutes = (km: number) => Math.max(1, Math.round(km * 3))
