import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CENTER } from '../data/seed'
import { uid } from '../lib/format'
import { errorMsg, supabase } from '../lib/supabase'
import type { AppState, AprobacionEstado, Estado, LatLng, MetodoPago, Notificacion, NurseDetail, Role, Servicio, User } from '../types'

// ponytail: Realtime avisa de cambios y se vuelve a consultar el estado; respaldo cada 30 s.
const FALLBACK_MS = 30000
const EMPTY: AppState = { users: [], nurses: {}, servicios: [], notifs: [], sessionId: null }
const ACTIVOS: Estado[] = ['aceptado', 'en_camino', 'en_atencion']

// ---------- Filas tal como llegan de Supabase ----------
interface ProfileRow { id: string; rol: Role; nombre: string; telefono: string; direccion: string; lat: number | null; lng: number | null; calificacion: number; color: string }
interface NurseRow { usuario_id: string; especialidad: string; documentos: string[]; aprobado: AprobacionEstado; ganancias: number; online: boolean; visto: string; servicios: number; experiencia: number; bio: string }
interface ServicioRow {
  id: string; paciente_id: string; enfermero_id: string | null; candidato: string | null; servicio_id: string; estado: Estado
  lat: number; lng: number; direccion: string; inmediato: boolean; fecha_hora: string | null; notas: string; total: number
  metodo_pago: MetodoPago; calificacion: number | null; resena: string; llego: boolean; rechazados: string[]
  oferta_inicio: string | null; creado: string; estado_ts: string
}
interface NotifRow { id: string; user_id: string; titulo: string; cuerpo: string; tipo: Notificacion['tipo']; leida: boolean; creado: string }
interface ContactoRow { id: string; nombre: string; color: string; calificacion: number; telefono: string | null; especialidad: string | null; servicios: number | null; lat: number | null; lng: number | null }
interface CercaRow { id: string; nombre: string; color: string; calificacion: number; especialidad: string; servicios: number; lat: number; lng: number }
interface OfertaRow { id: string; servicio_id: string; lat_aprox: number; lng_aprox: number; inmediato: boolean; fecha_hora: string | null; notas: string; total: number; oferta_inicio: string }

const ms = (t: string | null) => (t ? Date.parse(t) : 0)

async function fetchState(session: Session): Promise<AppState> {
  const meId = session.user.id
  const [profiles, nurses, servicios, notifs, contactos, ofertas] = await Promise.all([
    supabase.from('profiles').select('*'), // RLS: el propio, o todos si es admin
    supabase.from('nurse_details').select('*'),
    supabase.from('servicios').select('*').order('creado', { ascending: false }).limit(100),
    supabase.from('notificaciones').select('*').order('creado', { ascending: false }).limit(50),
    supabase.rpc('mis_contactos'),
    supabase.rpc('mis_ofertas'),
  ])
  const failed = [profiles, nurses, servicios, notifs, contactos, ofertas].find((r) => r.error)
  if (failed?.error) throw failed.error

  const meRow = (profiles.data as ProfileRow[]).find((p) => p.id === meId)
  if (!meRow) throw new Error('sin_perfil')
  const cerca: CercaRow[] =
    meRow.rol === 'paciente' && meRow.lat !== null
      ? ((await supabase.rpc('enfermeras_cerca', { p_lat: meRow.lat, p_lng: meRow.lng, p_radio: 10 })).data ?? [])
      : []

  const users = new Map<string, User>()
  const pos = new Map<string, LatLng>() // posición real conocida (no el CENTER de relleno)
  const nurseMap: Record<string, NurseDetail> = {}
  const nurse = (id: string, p: Partial<NurseDetail>) => {
    nurseMap[id] = {
      ...(nurseMap[id] ?? {
        usuario_id: id, especialidad: '', documentos_url: [], aprobado_por_admin: 'aprobado', ganancias: 0,
        online: false, servicios: 0, experiencia: 0, bio: '',
      }),
      ...p,
    }
  }
  const user = (u: Omit<User, 'email' | 'direccion'> & Partial<User>) =>
    users.set(u.id, { email: '', direccion: '', ...u, calificacion: Number(u.calificacion) })

  for (const c of (contactos.data ?? []) as ContactoRow[]) {
    const loc = c.lat !== null && c.lng !== null ? { lat: c.lat, lng: c.lng } : null
    if (loc) pos.set(c.id, loc)
    user({ id: c.id, rol: c.especialidad ? 'enfermero' : 'paciente', nombre: c.nombre, telefono: c.telefono ?? '', ubicacion: loc ?? CENTER, calificacion: c.calificacion, color: c.color })
    if (c.especialidad) nurse(c.id, { especialidad: c.especialidad, servicios: c.servicios ?? 0 })
  }
  for (const c of cerca) {
    user({ id: c.id, rol: 'enfermero', nombre: c.nombre, telefono: '', ubicacion: { lat: c.lat, lng: c.lng }, calificacion: c.calificacion, color: c.color })
    nurse(c.id, { especialidad: c.especialidad, servicios: c.servicios, online: true })
  }
  for (const p of profiles.data as ProfileRow[]) {
    const loc = p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : null
    if (loc) pos.set(p.id, loc)
    user({ id: p.id, rol: p.rol, nombre: p.nombre, telefono: p.telefono, direccion: p.direccion, ubicacion: loc ?? CENTER, calificacion: p.calificacion, color: p.color, email: p.id === meId ? session.user.email ?? '' : '' })
  }
  for (const d of nurses.data as NurseRow[]) {
    nurse(d.usuario_id, {
      especialidad: d.especialidad, documentos_url: d.documentos, aprobado_por_admin: d.aprobado, ganancias: d.ganancias,
      // El servidor solo ofrece servicios a quien reportó actividad hace menos de 2 min; aquí se refleja igual para los demás usuarios.
      online: d.online && (d.usuario_id === meId || Date.now() - new Date(d.visto).getTime() < 120_000), servicios: d.servicios, experiencia: d.experiencia, bio: d.bio,
    })
  }

  const base = { llego_ts: 0, manual: true, rechazados: [] as string[] }
  const svcs: Servicio[] = (servicios.data as ServicioRow[]).map((r) => {
    const pac = { lat: r.lat, lng: r.lng }
    const activo = ACTIVOS.includes(r.estado) && r.enfermero_id !== null
    return {
      ...base, id: r.id, paciente_id: r.paciente_id, enfermero_id: r.enfermero_id, servicio_id: r.servicio_id, estado: r.estado,
      ubicacion_paciente: pac, direccion: r.direccion, inmediato: r.inmediato, fecha_hora: r.fecha_hora, notas: r.notas,
      total: r.total, metodo_pago: r.metodo_pago, calificacion: r.calificacion, resena: r.resena, creado: ms(r.creado),
      estado_ts: ms(r.estado_ts), nursePos: !activo ? null : r.llego ? pac : pos.get(r.enfermero_id!) ?? null,
      llego: r.llego, candidato: r.candidato, oferta_inicio: ms(r.oferta_inicio), rechazados: r.rechazados,
    }
  })
  // Ofertas: no están en `servicios` (RLS) y la ubicación es aproximada hasta aceptar.
  for (const o of (ofertas.data ?? []) as OfertaRow[]) {
    svcs.unshift({
      ...base, id: o.id, paciente_id: '', enfermero_id: null, servicio_id: o.servicio_id, estado: 'solicitado',
      ubicacion_paciente: { lat: o.lat_aprox, lng: o.lng_aprox }, direccion: 'Dirección exacta al aceptar',
      inmediato: o.inmediato, fecha_hora: o.fecha_hora, notas: o.notas, total: o.total, metodo_pago: 'efectivo',
      calificacion: null, resena: '', creado: ms(o.oferta_inicio), estado_ts: ms(o.oferta_inicio), nursePos: null,
      llego: false, candidato: meId, oferta_inicio: ms(o.oferta_inicio),
    })
  }

  return {
    sessionId: meId,
    users: [...users.values()],
    nurses: nurseMap,
    servicios: svcs,
    notifs: (notifs.data as NotifRow[]).map((n) => ({ id: n.id, userId: n.user_id, titulo: n.titulo, cuerpo: n.cuerpo, ts: ms(n.creado), leida: n.leida, tipo: n.tipo })),
  }
}

export interface Draft {
  servicio_id: string
  inmediato: boolean
  fecha_hora: string | null
  notas: string
  metodo_pago: MetodoPago
  direccion: string
  ubicacion: LatLng
}

export interface Quote { base: number; recargo: number; desplazamiento: number; total: number }

export interface Registro {
  rol: 'paciente' | 'enfermero'
  nombre: string
  email: string
  telefono: string
  password: string
  especialidad?: string
}

interface Ctx {
  state: AppState
  me: User | null
  myNurse: NurseDetail | null
  toasts: Notificacion[]
  dismissToast: (id: string) => void
  /** Devuelve el mensaje de error, o null si entró. */
  login: (email: string, password: string) => Promise<string | null>
  /** Envía el correo de recuperación. Devuelve el mensaje de error, o null si salió. */
  requestReset: (email: string) => Promise<string | null>
  /** Cambia la contraseña de la sesión de recuperación. Devuelve el error, o null. */
  setPassword: (password: string) => Promise<string | null>
  logout: () => Promise<void>
  /** needsConfirm: Supabase pide confirmar el correo antes de dar sesión. */
  register: (r: Registro) => Promise<{ error: string | null; needsConfirm: boolean }>
  setLocation: (pos: LatLng, direccion: string) => Promise<void>
  toggleOnline: () => Promise<void>
  cotizar: (servicio: string, inmediato: boolean, pos: LatLng) => Promise<Quote | null>
  /** Devuelve el id del servicio creado, o null si falló (ya se mostró el error). */
  requestService: (d: Draft) => Promise<string | null>
  accept: (id: string) => Promise<void>
  reject: (id: string) => Promise<void>
  advance: (id: string) => Promise<void>
  cancel: (id: string) => Promise<void>
  rate: (id: string, stars: number, resena: string) => Promise<void>
  approve: (nurseId: string, ok: boolean) => Promise<void>
  uploadDocs: (files: File[]) => Promise<boolean>
  openDoc: (path: string) => Promise<void>
  markAllRead: () => Promise<void>
}

type Actions = Omit<Ctx, 'state' | 'me' | 'myNurse' | 'toasts'>
type StateValue = Pick<Ctx, 'state' | 'me' | 'myNurse' | 'toasts'>

// Dos contextos: quien solo dispara acciones no se re-renderiza con cada actualización.
const StateCtx = createContext<StateValue | null>(null)
const ActionsCtx = createContext<Actions | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [state, setState] = useState<AppState>(EMPTY)
  const [toasts, setToasts] = useState<Notificacion[]>([])
  const sessionRef = useRef(session)
  sessionRef.current = session
  const stateRef = useRef(state)
  stateRef.current = state
  // null = primera carga de la sesión: las notificaciones viejas no salen como toast
  const seen = useRef<Set<string> | null>(null)

  const toast = useCallback((cuerpo: string, titulo = 'No se pudo completar') => {
    setToasts((t) => [{ id: uid('t'), userId: '', titulo, cuerpo, ts: Date.now(), leida: true, tipo: 'alerta' as const }, ...t].slice(0, 3))
  }, [])

  const refresh = useCallback(async () => {
    const s = sessionRef.current
    if (!s) return
    try {
      const next = await fetchState(s)
      if (sessionRef.current?.user.id !== s.user.id) return // cerró sesión mientras cargaba
      // Sin cambios no hay re-render (evita reiniciar animaciones cada 3 s).
      setState((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    } catch (e) {
      if (e instanceof Error && e.message === 'sin_perfil') {
        toast('Tu cuenta no tiene perfil. Escríbenos a soporte.')
        await supabase.auth.signOut()
      } else {
        console.error(e) // red caída: se conserva el último estado y se reintenta en el próximo ciclo
      }
    } finally {
      setLoadedFor(s.user.id)
    }
  }, [toast])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null
  useEffect(() => {
    seen.current = null
    setToasts([])
    setState(EMPTY)
    if (!userId) {
      setLoadedFor(null) // si vuelve a entrar el mismo usuario, se espera su carga de nuevo
      return
    }
    // Diferido: onAuthStateChange no debe esperar llamadas a Supabase dentro del mismo ciclo.
    const first = setTimeout(refresh, 0)
    // Cambios en tiempo real: RLS filtra lo que cada usuario recibe. Las ofertas llegan como notificación ("Nueva solicitud cerca").
    const channel = supabase
      .channel(`app-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicios' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nurse_details' }, refresh)
      .subscribe()
    // Respaldo por si se cae el socket: una consulta cada 30 s con la pestaña visible.
    const t = setInterval(() => {
      if (!document.hidden) refresh()
    }, FALLBACK_MS)
    return () => {
      clearTimeout(first)
      clearInterval(t)
      supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  // Toasts para notificaciones nuevas
  useEffect(() => {
    if (!state.sessionId) return
    if (!seen.current) {
      seen.current = new Set(state.notifs.map((n) => n.id))
      return
    }
    const fresh = state.notifs.filter((n) => !seen.current!.has(n.id))
    if (!fresh.length) return
    fresh.forEach((n) => seen.current!.add(n.id))
    setToasts((t) => [...fresh.reverse(), ...t].slice(0, 3))
  }, [state.notifs, state.sessionId])

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const me = state.users.find((u) => u.id === state.sessionId) ?? null
  const myNurse = me && me.rol === 'enfermero' ? state.nurses[me.id] ?? null : null

  // Posición real del profesional: solo mientras está conectado y aprobado. El servidor la usa para ofertas y el mapa del paciente.
  const sendingLocation = !!userId && !!myNurse?.online && myNurse.aprobado_por_admin === 'aprobado'
  useEffect(() => {
    if (!sendingLocation || !('geolocation' in navigator)) return
    let last = 0
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const now = Date.now()
        if (now - last < 10000) return // máximo una escritura cada 10 s
        last = now
        supabase.rpc('set_ubicacion', { p_lat: coords.latitude, p_lng: coords.longitude }).then(({ error }) => {
          if (error) console.error(error)
        })
      },
      () => toast('Activa la ubicación para aparecer cerca de los pacientes.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [sendingLocation, toast])

  // Latido de presencia: el servidor solo manda ofertas a quien reportó actividad en los últimos 2 minutos.
  // Con la pestaña oculta no se envía (el navegador congela el temporizador): ese profesional deja de recibir ofertas, como corresponde.
  useEffect(() => {
    if (!sendingLocation) return
    const beat = () => {
      if (document.visibilityState === 'visible') void supabase.rpc('latido')
    }
    beat()
    const t = setInterval(beat, 30_000)
    document.addEventListener('visibilitychange', beat)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [sendingLocation])

  // Acciones estables: leen el estado por ref, así su identidad no cambia entre actualizaciones.
  const api = useMemo<Actions>(() => {
    /** Llama una RPC; si falla muestra el error. Siempre refresca después. */
    const call = async (fn: string, args?: Record<string, unknown>) => {
      const { error } = await supabase.rpc(fn, args)
      if (error) toast(errorMsg(error))
      await refresh()
      return !error
    }
    const meId = () => sessionRef.current!.user.id
    return {
      dismissToast,
      login: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? errorMsg(error) : null
      },
      requestReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}restablecer`,
        })
        return error ? errorMsg(error) : null
      },
      setPassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        return error ? errorMsg(error) : null
      },
      logout: async () => {
        await supabase.auth.signOut()
      },
      register: async ({ rol, nombre, email, telefono, password, especialidad }) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { rol, nombre, telefono, especialidad }, emailRedirectTo: window.location.origin },
        })
        return { error: error ? errorMsg(error) : null, needsConfirm: !error && !data.session }
      },
      setLocation: async (p, direccion) => {
        const [a, b] = await Promise.all([
          supabase.rpc('set_ubicacion', { p_lat: p.lat, p_lng: p.lng }),
          supabase.from('profiles').update({ direccion: direccion.slice(0, 200) }).eq('id', meId()),
        ])
        const error = a.error ?? b.error
        if (error) toast(errorMsg(error))
        await refresh()
      },
      toggleOnline: async () => {
        await call('set_online', { p_online: !stateRef.current.nurses[meId()]?.online })
      },
      cotizar: async (servicio, inmediato, p) => {
        const { data, error } = await supabase.rpc('cotizar', { p_servicio: servicio, p_inmediato: inmediato, p_lat: p.lat, p_lng: p.lng })
        if (error) {
          toast(errorMsg(error))
          return null
        }
        return (data as Quote[])[0] ?? null
      },
      requestService: async (d) => {
        const { data, error } = await supabase.rpc('solicitar_servicio', {
          p_servicio: d.servicio_id, p_inmediato: d.inmediato,
          // datetime-local no trae zona: se interpreta en la hora local del dispositivo
          p_fecha: d.fecha_hora ? new Date(d.fecha_hora).toISOString() : null,
          p_notas: d.notas, p_metodo: d.metodo_pago, p_lat: d.ubicacion.lat, p_lng: d.ubicacion.lng, p_direccion: d.direccion,
        })
        if (error) {
          toast(errorMsg(error))
          return null
        }
        await refresh()
        return data as string
      },
      accept: async (id) => {
        await call('aceptar_oferta', { p_id: id })
      },
      reject: async (id) => {
        await call('rechazar_oferta', { p_id: id })
      },
      advance: async (id) => {
        await call('avanzar_servicio', { p_id: id })
      },
      cancel: async (id) => {
        await call('cancelar_servicio', { p_id: id })
      },
      rate: async (id, stars, resena) => {
        await call('calificar_servicio', { p_id: id, p_estrellas: stars, p_resena: resena })
      },
      approve: async (nurseId, ok) => {
        await call('aprobar_enfermero', { p_id: nurseId, p_ok: ok })
      },
      uploadDocs: async (files) => {
        const paths: string[] = []
        for (const f of files) {
          // Storage no acepta cualquier carácter en la ruta: nombre saneado y prefijo de tiempo para no pisar archivos.
          const path = `${meId()}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, '_')}`
          const { error } = await supabase.storage.from('documentos').upload(path, f)
          if (error) {
            toast(errorMsg(error))
            return false
          }
          paths.push(path)
        }
        return call('set_documentos', { p_paths: paths })
      },
      openDoc: async (path) => {
        // Se abre la pestaña antes del await: Safari bloquea window.open fuera del gesto del usuario.
        const w = window.open('', '_blank')
        const { data, error } = await supabase.storage.from('documentos').createSignedUrl(path, 60)
        if (error || !data) {
          w?.close()
          toast(errorMsg(error ?? { message: 'No se pudo abrir el documento.' }))
          return
        }
        if (w) w.location.href = data.signedUrl
      },
      markAllRead: async () => {
        await supabase.from('notificaciones').update({ leida: true }).eq('user_id', meId()).eq('leida', false)
        await refresh()
      },
    }
  }, [dismissToast, refresh, toast])

  const stateValue = useMemo<StateValue>(() => ({ state, me, myNurse, toasts }), [state, me, myNurse, toasts])

  const ready = authReady && (userId === null || loadedFor === userId)
  if (!ready)
    return (
      <div className="app-shell flex items-center justify-center" role="status" aria-label="Cargando">
        <span className="spin h-10 w-10 rounded-full border-4 border-brand-100 border-t-brand-600" />
      </div>
    )

  return (
    <StateCtx.Provider value={stateValue}>
      <ActionsCtx.Provider value={api}>{children}</ActionsCtx.Provider>
    </StateCtx.Provider>
  )
}

/** Estado completo; se re-renderiza con cada actualización. */
export function useApp(): Ctx {
  const s = useContext(StateCtx)
  const a = useContext(ActionsCtx)
  if (!s || !a) throw new Error('useApp fuera de AppProvider')
  return { ...s, ...a }
}

/** Solo acciones: no se re-renderiza con las actualizaciones. */
export function useAppActions(): Actions {
  const a = useContext(ActionsCtx)
  if (!a) throw new Error('useAppActions fuera de AppProvider')
  return a
}
