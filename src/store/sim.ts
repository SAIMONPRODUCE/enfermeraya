import { CATALOGO } from '../data/seed'
import { haversine } from '../lib/geo'
import type { AppState, LatLng, NurseDetail, Servicio, User } from '../types'

export const OFFER_TTL = 20000
export const RADIUS_KM = 10
export const ACTIVE: Servicio['estado'][] = ['solicitado', 'aceptado', 'en_camino', 'en_atencion']
const BUSY: Servicio['estado'][] = ['aceptado', 'en_camino', 'en_atencion']

export const isActive = (s: Servicio) => ACTIVE.includes(s.estado)
export const serviceOf = (id: string) => CATALOGO.find((c) => c.id === id)!
/** Tarifa del profesional para el servicio; sin tarifa propia, el precio sugerido. */
export const tarifaDe = (state: AppState, nurseId: string, sid: string) => state.tarifas[nurseId]?.[sid] ?? serviceOf(sid).precio_base
/** Precio más bajo entre los disponibles; sin nadie cerca, el sugerido. */
export const desde = (state: AppState, near: Candidate[], sid: string) =>
  near.length ? Math.min(...near.map((c) => tarifaDe(state, c.user.id, sid))) : serviceOf(sid).precio_base

export interface Candidate {
  user: User
  detail: NurseDetail
  dist: number
}

export function availableNurses(
  state: AppState,
  from: LatLng,
  exclude: string[] = [],
  radius = RADIUS_KM,
): Candidate[] {
  return state.users
    .filter((u) => u.rol === 'enfermero' && !exclude.includes(u.id))
    .map((user) => ({ user, detail: state.nurses[user.id], dist: haversine(from, user.ubicacion) }))
    .filter(
      (c) =>
        c.detail &&
        c.detail.online &&
        c.detail.aprobado_por_admin === 'aprobado' &&
        c.dist <= radius &&
        !state.servicios.some((s) => s.enfermero_id === c.user.id && BUSY.includes(s.estado)) &&
        // ya tiene una oferta pendiente de respuesta
        !state.servicios.some((s) => s.candidato === c.user.id && s.estado === 'solicitado'),
    )
    .sort((a, b) => a.dist - b.dist)
}
