import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { seedState } from '../data/seed'
import { uid } from '../lib/format'
import type { AppState, LatLng, MetodoPago, Notificacion, NurseDetail, Servicio, User } from '../types'
import { actions, isActive, tick } from './sim'

const KEY = 'enfermeraya-v2'
const MAX_NOTIFS = 100
const MAX_TERMINAL = 50

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return prune(JSON.parse(raw) as AppState)
  } catch {
    /* ignore */
  }
  return seedState()
}

/** Acota notifs y servicios terminados para que localStorage no crezca sin límite. Devuelve el mismo objeto si no hay nada que podar. */
function prune(s: AppState): AppState {
  const terminal = s.servicios.filter((x) => !isActive(x))
  const notifsOver = s.notifs.length > MAX_NOTIFS
  const termOver = terminal.length > MAX_TERMINAL
  if (!notifsOver && !termOver) return s
  const keep = new Set(terminal.slice(0, MAX_TERMINAL).map((x) => x.id))
  return {
    ...s,
    notifs: s.notifs.slice(0, MAX_NOTIFS),
    servicios: s.servicios.filter((x) => isActive(x) || keep.has(x.id)),
  }
}

export interface Draft {
  servicio_id: string
  inmediato: boolean
  fecha_hora: string | null
  notas: string
  metodo_pago: MetodoPago
  total: number
  direccion: string
  ubicacion: LatLng
}

interface Ctx {
  state: AppState
  me: User | null
  myNurse: NurseDetail | null
  toasts: Notificacion[]
  dismissToast: (id: string) => void
  login: (userId: string) => void
  logout: () => void
  registerPatient: (p: { nombre: string; email: string; telefono: string }) => void
  registerNurse: (p: { nombre: string; email: string; telefono: string; especialidad: string; docs: string[] }) => void
  setLocation: (pos: LatLng, direccion: string) => void
  toggleOnline: () => void
  requestService: (d: Draft) => string
  accept: (id: string) => void
  reject: (id: string) => void
  advance: (id: string) => void
  cancel: (id: string) => void
  rate: (id: string, stars: number, resena: string) => void
  approve: (nurseId: string, ok: boolean) => void
  demoRequest: () => void
  markAllRead: () => void
  reset: () => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load)
  const ref = useRef(state)
  ref.current = state
  const [toasts, setToasts] = useState<Notificacion[]>([])
  const seen = useRef(new Set(state.notifs.map((n) => n.id)))

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // cuota llena o storage bloqueado (modo privado): la sesión sigue en memoria
    }
  }, [state])

  // Simulación en tiempo real (1 paso por segundo)
  useEffect(() => {
    const t = setInterval(() => setState((s) => prune(tick(s, Date.now()))), 1000)
    return () => clearInterval(t)
  }, [])

  // Toasts para notificaciones nuevas del usuario activo
  useEffect(() => {
    const fresh = state.notifs.filter((n) => !seen.current.has(n.id))
    if (!fresh.length) return
    fresh.forEach((n) => seen.current.add(n.id))
    const mine = fresh.filter((n) => n.userId === state.sessionId)
    if (mine.length) setToasts((t) => [...mine.reverse(), ...t].slice(0, 3))
  }, [state.notifs, state.sessionId])

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const me = state.users.find((u) => u.id === state.sessionId) ?? null
  const myNurse = me && me.rol === 'enfermero' ? state.nurses[me.id] ?? null : null

  const api = useMemo<Ctx>(() => {
    const up = (fn: (s: AppState) => AppState) => setState(fn)
    const sid = () => ref.current.sessionId!
    return {
      state,
      me,
      myNurse,
      toasts,
      dismissToast,
      login: (userId) => up((s) => ({ ...s, sessionId: userId })),
      logout: () => {
        setToasts([])
        up((s) => ({ ...s, sessionId: null }))
      },
      registerPatient: ({ nombre, email, telefono }) =>
        up((s) => {
          const id = uid('p')
          const u: User = { id, rol: 'paciente', nombre, email, telefono, ubicacion: { lat: 4.7143, lng: -74.0645 }, direccion: 'Cra 15 #93-40, Chapinero', calificacion: 5, color: '#1d6fe8' }
          return { ...s, users: [...s.users, u], sessionId: id }
        }),
      registerNurse: ({ nombre, email, telefono, especialidad, docs }) =>
        up((s) => {
          const id = uid('n')
          const u: User = { id, rol: 'enfermero', nombre, email, telefono, ubicacion: { lat: 4.7143 + (Math.random() - 0.5) * 0.02, lng: -74.0645 + (Math.random() - 0.5) * 0.02 }, direccion: '', calificacion: 5, color: '#0ea5a4' }
          const d: NurseDetail = { usuario_id: id, especialidad, documentos_url: docs, aprobado_por_admin: 'pendiente', ganancias: 0, online: false, servicios: 0, experiencia: 0, bio: 'Nuevo profesional en EnfermeraYa.' }
          const notifs = [...s.notifs]
          notifs.unshift({ id: uid('nt'), userId: 'a1', titulo: 'Nuevo perfil por validar', cuerpo: `${nombre} envió su documentación.`, ts: Date.now(), leida: false, tipo: 'info' })
          return { ...s, users: [...s.users, u], nurses: { ...s.nurses, [id]: d }, notifs, sessionId: id }
        }),
      setLocation: (pos, direccion) =>
        up((s) => ({ ...s, users: s.users.map((u) => (u.id === s.sessionId ? { ...u, ubicacion: pos, direccion } : u)) })),
      toggleOnline: () => {
        const id = sid()
        const goingOnline = !ref.current.nurses[id]?.online
        up((s) => ({ ...s, nurses: { ...s.nurses, [id]: { ...s.nurses[id], online: !s.nurses[id].online } } }))
        if (goingOnline) {
          setTimeout(() => {
            const s = ref.current
            const busy = s.servicios.some((x) => x.candidato === id && isActive(x))
            if (s.sessionId === id && s.nurses[id]?.online && !busy)
              up((st) => actions.demoRequest(st, id, uid('s'), Date.now()))
          }, 5000)
        }
      },
      requestService: (d) => {
        const id = uid('s')
        const now = Date.now()
        const s: Servicio = {
          id, paciente_id: sid(), enfermero_id: null, servicio_id: d.servicio_id, estado: 'solicitado',
          ubicacion_paciente: d.ubicacion, direccion: d.direccion, inmediato: d.inmediato, fecha_hora: d.fecha_hora,
          notas: d.notas, total: d.total, metodo_pago: d.metodo_pago, calificacion: null, resena: '', creado: now,
          estado_ts: now, nursePos: null, llego: false, llego_ts: 0, manual: false, candidato: null, oferta_inicio: now, rechazados: [],
        }
        up((st) => actions.create(st, s))
        return id
      },
      accept: (id) => up((s) => actions.accept(s, id, sid(), true, Date.now())),
      reject: (id) => up((s) => actions.reject(s, id, Date.now())),
      advance: (id) => up((s) => actions.advance(s, id, Date.now())),
      cancel: (id) => up((s) => actions.cancel(s, id, Date.now())),
      rate: (id, stars, resena) => up((s) => actions.rate(s, id, stars, resena, Date.now())),
      approve: (nurseId, ok) =>
        up((s) => {
          const notifs = [...s.notifs]
          notifs.unshift({
            id: uid('nt'), userId: nurseId, ts: Date.now(), leida: false, tipo: ok ? 'exito' : 'alerta',
            titulo: ok ? '¡Perfil aprobado!' : 'Documentación rechazada',
            cuerpo: ok ? 'Ya puedes conectarte y recibir servicios.' : 'Revisa tus documentos y vuelve a enviarlos.',
          })
          return { ...s, notifs, nurses: { ...s.nurses, [nurseId]: { ...s.nurses[nurseId], aprobado_por_admin: ok ? 'aprobado' : 'rechazado' } } }
        }),
      demoRequest: () => up((s) => actions.demoRequest(s, sid(), uid('s'), Date.now())),
      markAllRead: () =>
        up((s) => ({ ...s, notifs: s.notifs.map((n) => (n.userId === s.sessionId ? { ...n, leida: true } : n)) })),
      reset: () => {
        seen.current = new Set()
        setToasts([])
        setState(seedState())
      },
    }
  }, [state, me, myNurse, toasts, dismissToast])

  return <AppCtx.Provider value={api}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp fuera de AppProvider')
  return c
}
