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
  /** Versión de términos aceptada (solo se conoce la propia). */
  terminos?: string
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
  /** Cédula (para verificar ReTHUS) y código REPS; solo los ve el propio profesional y el admin. */
  documento: string
  reps: string
}

export interface ServiceCatalog {
  id: string
  nombre: string
  /** Precio sugerido; cada profesional fija el suyo entre precio_min y precio_max. */
  precio_base: number
  precio_min: number
  precio_max: number
  /** false = ya no se ofrece; se conserva para mostrar servicios viejos. */
  activo?: boolean
  /** Exige adjuntar orden médica (inyectología, terapia IV). */
  requiere_orden?: boolean
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
  /** Ruta de la orden médica en el bucket privado 'ordenes' ('' si el servicio no la exige). */
  orden: string
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

export type RetiroEstado = 'pendiente' | 'pagado' | 'rechazado'
export type MetodoCobro = 'nequi' | 'daviplata' | 'banco'

/** Cuenta donde el profesional recibe sus retiros. */
export interface CuentaCobro {
  metodo: MetodoCobro
  banco: string
  tipo_cuenta: '' | 'ahorros' | 'corriente'
  numero: string
  titular: string
}

export interface Retiro extends CuentaCobro {
  id: string
  usuario_id: string
  monto: number
  estado: RetiroEstado
  referencia: string
  nota: string
  creado: number
  resuelto_ts: number
}

export interface AppState {
  users: User[]
  nurses: Record<string, NurseDetail>
  servicios: Servicio[]
  notifs: Notificacion[]
  /** Retiros: los propios, o todos si es admin. */
  retiros: Retiro[]
  /** Cuenta de cobro del profesional que tiene la sesión. */
  cuenta: CuentaCobro | null
  /** Tarifa propia de cada profesional: tarifas[enfermeroId][servicioId]. Sin entrada = precio sugerido. */
  tarifas: Record<string, Record<string, number>>
  /** Profesional: saldo del servidor (ganancias - retiros - comisiones de efectivo + abonos). Negativo = debe comisión. */
  saldo: number
  /** Admin: profesionales que deben comisión de servicios en efectivo. */
  deudas: { usuario_id: string; debe: number }[]
  sessionId: string | null
}
