export type Role = 'paciente' | 'enfermero' | 'admin'

export interface LatLng {
  lat: number
  lng: number
}

export interface User {
  id: string
  rol: Role
  nombre: string
  email: string
  telefono: string
  ubicacion: LatLng
  direccion: string
  calificacion: number
  color: string
}

export type AprobacionEstado = 'pendiente' | 'aprobado' | 'rechazado'

export interface NurseDetail {
  usuario_id: string
  especialidad: string
  documentos_url: string[]
  aprobado_por_admin: AprobacionEstado
  ganancias: number
  online: boolean
  servicios: number
  experiencia: number
  bio: string
}

export interface ServiceCatalog {
  id: string
  nombre: string
  precio_base: number
  descripcion: string
  icon: string
  duracion: string
}

export type Estado =
  | 'solicitado'
  | 'aceptado'
  | 'en_camino'
  | 'en_atencion'
  | 'completado'
  | 'cancelado'
  | 'sin_cobertura'

export type MetodoPago = 'tarjeta' | 'efectivo' | 'transferencia'

export interface Servicio {
  id: string
  paciente_id: string
  enfermero_id: string | null
  servicio_id: string
  estado: Estado
  ubicacion_paciente: LatLng
  direccion: string
  inmediato: boolean
  fecha_hora: string | null
  notas: string
  total: number
  metodo_pago: MetodoPago
  calificacion: number | null
  resena: string
  creado: number
  estado_ts: number
  nursePos: LatLng | null
  llego: boolean
  llego_ts: number
  manual: boolean
  candidato: string | null
  oferta_inicio: number
  rechazados: string[]
}

export interface Notificacion {
  id: string
  userId: string
  titulo: string
  cuerpo: string
  ts: number
  leida: boolean
  tipo: 'info' | 'exito' | 'alerta'
}

export interface AppState {
  users: User[]
  nurses: Record<string, NurseDetail>
  servicios: Servicio[]
  notifs: Notificacion[]
  sessionId: string | null
}
