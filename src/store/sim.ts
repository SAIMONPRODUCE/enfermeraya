import { CATALOGO } from '../data/seed'
import { haversine, stepToward } from '../lib/geo'
import { uid } from '../lib/format'
import type {
  AppState,
  LatLng,
  MetodoPago,
  Notificacion,
  NurseDetail,
  Servicio,
  User,
} from '../types'

export const OFFER_TTL = 20000
export const RADIUS_KM = 10
export const ACTIVE: Servicio['estado'][] = ['solicitado', 'aceptado', 'en_camino', 'en_atencion']
const BUSY: Servicio['estado'][] = ['aceptado', 'en_camino', 'en_atencion']

export const isActive = (s: Servicio) => ACTIVE.includes(s.estado)
export const serviceOf = (id: string) => CATALOGO.find((c) => c.id === id)!

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

export function quote(base: number, inmediato: boolean, nearestKm: number | null) {
  const recargo = inmediato ? Math.round((base * 0.2) / 500) * 500 : 0
  const desplazamiento = Math.max(2000, Math.round(((nearestKm ?? 3) * 1000) / 500) * 500)
  return { base, recargo, desplazamiento, total: base + recargo + desplazamiento }
}

function pushNotif(
  list: Notificacion[],
  userId: string,
  titulo: string,
  cuerpo: string,
  tipo: Notificacion['tipo'] = 'info',
  now = Date.now(),
) {
  list.unshift({ id: uid('nt'), userId, titulo, cuerpo, ts: now, leida: false, tipo })
}

const nameOf = (state: AppState, id: string | null) =>
  state.users.find((u) => u.id === id)?.nombre ?? 'Tu enfermero'

/** Aplica un cambio a un servicio y devuelve nuevo estado */
function mutate(
  state: AppState,
  id: string,
  fn: (s: Servicio, notify: (u: string, t: string, c: string, tipo?: Notificacion['tipo']) => void) => Partial<Servicio>,
  now: number,
  extra?: (nurses: Record<string, NurseDetail>, s: Servicio) => void,
): AppState {
  const notifs = [...state.notifs]
  const nurses = { ...state.nurses }
  let found: Servicio | null = null
  const servicios = state.servicios.map((s) => {
    if (s.id !== id) return s
    const patch = fn(s, (u, t, c, tipo) => pushNotif(notifs, u, t, c, tipo, now))
    found = { ...s, ...patch }
    return found
  })
  if (found && extra) extra(nurses, found)
  return { ...state, servicios, notifs, nurses }
}

function completeEffects(nurses: Record<string, NurseDetail>, s: Servicio) {
  if (!s.enfermero_id || !nurses[s.enfermero_id]) return
  const d = nurses[s.enfermero_id]
  nurses[s.enfermero_id] = {
    ...d,
    ganancias: d.ganancias + Math.round(s.total * 0.85),
    servicios: d.servicios + 1,
  }
}

export const actions = {
  create(state: AppState, s: Servicio): AppState {
    return { ...state, servicios: [s, ...state.servicios] }
  },

  accept(state: AppState, id: string, nurseId: string, manual: boolean, now: number): AppState {
    const offer = state.servicios.find((x) => x.id === id)
    // no aceptar si el servicio ya no está abierto, no es para esta enfermera o ella está ocupada
    if (!offer || offer.estado !== 'solicitado' || offer.candidato !== nurseId) return state
    if (state.servicios.some((x) => x.enfermero_id === nurseId && BUSY.includes(x.estado))) return state
    return mutate(
      state,
      id,
      (s, notify) => {
        notify(s.paciente_id, '¡Enfermero asignado!', `${nameOf(state, nurseId)} aceptó tu solicitud.`, 'exito')
        const pos = state.users.find((u) => u.id === nurseId)!.ubicacion
        return { enfermero_id: nurseId, candidato: nurseId, estado: 'aceptado', estado_ts: now, manual, nursePos: pos }
      },
      now,
    )
  },

  reject(state: AppState, id: string, now: number): AppState {
    return mutate(
      state,
      id,
      (s) => ({ rechazados: s.candidato ? [...s.rechazados, s.candidato] : s.rechazados, candidato: null, oferta_inicio: now }),
      now,
    )
  },

  /** Avance manual del profesional */
  advance(state: AppState, id: string, now: number): AppState {
    const cur = state.servicios.find((s) => s.id === id)
    if (!cur) return state
    if (cur.estado === 'aceptado')
      return mutate(state, id, (s, n) => {
        n(s.paciente_id, 'Tu enfermero va en camino', `${nameOf(state, s.enfermero_id)} salió hacia tu ubicación.`)
        return { estado: 'en_camino', estado_ts: now }
      }, now)
    if (cur.estado === 'en_camino' && !cur.llego)
      return mutate(state, id, (s, n) => {
        n(s.paciente_id, '¡Tu enfermero llegó!', 'Ya está en tu puerta.', 'exito')
        return { llego: true, llego_ts: now, nursePos: s.ubicacion_paciente }
      }, now)
    if (cur.estado === 'en_camino')
      return mutate(state, id, (s, n) => {
        n(s.paciente_id, 'Atención iniciada', 'El procedimiento comenzó.')
        return { estado: 'en_atencion', estado_ts: now }
      }, now)
    if (cur.estado === 'en_atencion')
      return mutate(state, id, (s, n) => {
        n(s.paciente_id, 'Servicio completado', 'Cuéntanos cómo te fue y califica la atención.', 'exito')
        if (s.enfermero_id) n(s.enfermero_id, 'Ganancia registrada', `+ $ ${Math.round(s.total * 0.85).toLocaleString('es-CO')}`, 'exito')
        return { estado: 'completado', estado_ts: now }
      }, now, completeEffects)
    return state
  },

  cancel(state: AppState, id: string, now: number): AppState {
    return mutate(state, id, (s, n) => {
      if (s.enfermero_id) n(s.enfermero_id, 'Servicio cancelado', 'El paciente canceló la solicitud.', 'alerta')
      return { estado: 'cancelado', estado_ts: now }
    }, now)
  },

  rate(state: AppState, id: string, stars: number, resena: string, now: number): AppState {
    const s = state.servicios.find((x) => x.id === id)
    const next = mutate(state, id, () => ({ calificacion: stars, resena }), now)
    if (!s?.enfermero_id) return next
    const nid = s.enfermero_id
    // `servicios` ya incluye este servicio (se contó al completar); el promedio previo es sobre n-1
    const n = Math.max(0, (next.nurses[nid]?.servicios ?? 1) - 1)
    return {
      ...next,
      users: next.users.map((u) =>
        u.id === nid ? { ...u, calificacion: Math.round(((u.calificacion * n + stars) / (n + 1)) * 10) / 10 } : u,
      ),
    }
  },

  /** Solicitud entrante de demostración dirigida a un enfermero */
  demoRequest(state: AppState, nurseId: string, id: string, now: number): AppState {
    const nurse = state.users.find((u) => u.id === nurseId)
    const patient = state.users.find((u) => u.rol === 'paciente')
    if (!nurse || !patient) return state
    if (state.servicios.some((x) => x.enfermero_id === nurseId && BUSY.includes(x.estado))) return state
    const svc = CATALOGO[Math.floor(Math.random() * CATALOGO.length)]
    const loc = {
      lat: nurse.ubicacion.lat + (Math.random() - 0.5) * 0.03,
      lng: nurse.ubicacion.lng + (Math.random() - 0.5) * 0.03,
    }
    const q = quote(svc.precio_base, true, haversine(nurse.ubicacion, loc))
    const s: Servicio = {
      id,
      paciente_id: patient.id,
      enfermero_id: null,
      servicio_id: svc.id,
      estado: 'solicitado',
      ubicacion_paciente: loc,
      direccion: 'Calle ' + (60 + Math.floor(Math.random() * 40)) + ' #' + (8 + Math.floor(Math.random() * 30)) + '-' + (10 + Math.floor(Math.random() * 80)),
      inmediato: true,
      fecha_hora: null,
      notas: 'Paciente con movilidad reducida, favor llamar al llegar.',
      total: q.total,
      metodo_pago: 'efectivo' as MetodoPago,
      calificacion: null,
      resena: '',
      creado: now,
      estado_ts: now,
      nursePos: null,
      llego: false,
      llego_ts: 0,
      manual: false,
      candidato: nurseId,
      oferta_inicio: now,
      rechazados: [],
    }
    const notifs = [...state.notifs]
    pushNotif(notifs, nurseId, 'Nueva solicitud cerca', `${svc.nombre} · ${q.total.toLocaleString('es-CO')} COP`, 'alerta', now)
    return { ...state, servicios: [s, ...state.servicios], notifs }
  },
}

/** Un paso de simulación (1 s). Devuelve el mismo objeto si nada cambió. */
export function tick(state: AppState, now: number): AppState {
  let changed = false
  const notifs = [...state.notifs]
  const nurses = { ...state.nurses }
  // enfermeras ofrecidas en este mismo tick (availableNurses solo ve el estado previo)
  const claimed = new Set<string>()

  const servicios = state.servicios.map((orig) => {
    let s = orig
    const set = (p: Partial<Servicio>) => {
      s = { ...s, ...p }
      changed = true
    }
    const N = (u: string, t: string, c: string, tipo: Notificacion['tipo'] = 'info') =>
      pushNotif(notifs, u, t, c, tipo, now)

    switch (s.estado) {
      case 'solicitado': {
        if (!s.candidato) {
          const c = availableNurses(state, s.ubicacion_paciente, [...s.rechazados, ...claimed])[0]
          if (!c) {
            set({ estado: 'sin_cobertura', estado_ts: now })
            N(s.paciente_id, 'Sin profesionales cerca', 'Ahora no hay enfermeros disponibles. Intenta de nuevo en unos minutos.', 'alerta')
          } else {
            claimed.add(c.user.id)
            set({ candidato: c.user.id, oferta_inicio: now })
            N(c.user.id, 'Nueva solicitud cerca', `${serviceOf(s.servicio_id).nombre} a ${c.dist.toFixed(1)} km`, 'alerta')
          }
          break
        }
        const human = s.candidato === state.sessionId
        const el = now - s.oferta_inicio
        if (human) {
          if (el > OFFER_TTL) {
            N(s.candidato, 'Solicitud expirada', 'No respondiste a tiempo.', 'alerta')
            set({ rechazados: [...s.rechazados, s.candidato], candidato: null })
          }
        } else if (el > 3000 + (s.id.charCodeAt(2) % 4) * 700) {
          const nid = s.candidato
          N(s.paciente_id, '¡Enfermero asignado!', `${nameOf(state, nid)} aceptó tu solicitud.`, 'exito')
          const pos = state.users.find((u) => u.id === nid)!.ubicacion
          set({ enfermero_id: nid, estado: 'aceptado', estado_ts: now, manual: false, nursePos: pos })
        }
        break
      }
      case 'aceptado':
        if (!s.manual && now - s.estado_ts > 2500) {
          N(s.paciente_id, 'Tu enfermero va en camino', `${nameOf(state, s.enfermero_id)} salió hacia tu ubicación.`)
          set({ estado: 'en_camino', estado_ts: now })
        }
        break
      case 'en_camino': {
        if (!s.llego && s.nursePos) {
          const np = stepToward(s.nursePos, s.ubicacion_paciente, 0.18, 0.08)
          const arrived = haversine(np, s.ubicacion_paciente) < 0.001
          set({ nursePos: np })
          if (arrived && !s.manual) {
            N(s.paciente_id, '¡Tu enfermero llegó!', 'Ya está en tu puerta.', 'exito')
            set({ llego: true, llego_ts: now })
          }
        } else if (s.llego && !s.manual && now - s.llego_ts > 2500) {
          N(s.paciente_id, 'Atención iniciada', 'El procedimiento comenzó.')
          set({ estado: 'en_atencion', estado_ts: now })
        }
        break
      }
      case 'en_atencion':
        if (!s.manual && now - s.estado_ts > 9000) {
          N(s.paciente_id, 'Servicio completado', 'Cuéntanos cómo te fue y califica la atención.', 'exito')
          set({ estado: 'completado', estado_ts: now })
          completeEffects(nurses, s)
        }
        break
    }
    return s
  })

  return changed ? { ...state, servicios, notifs, nurses } : state
}
