export const money = (n: number) => '$ ' + Math.round(n).toLocaleString('es-CO')

/** Solo colores #rrggbb llegan a estilos (el servidor ya lo exige; esto cubre datos viejos o alterados). */
export const safeColor = (c: string | undefined, fallback = '#1d6fe8') => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback)

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 10) return 'ahora'
  if (s < 60) return `hace ${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  return new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const uid = (p: string) => p + Math.random().toString(36).slice(2, 9)

/** Nombre legible de un documento en Storage: `<uid>/<timestamp>-<nombre>` → `<nombre>` */
export const docName = (path: string) => path.split('/').pop()!.replace(/^\d+-/, '')

/** true si `ts` cae en el mismo día calendario (hora local) que `ref` */
export function isSameDay(ts: number, ref = Date.now()): boolean {
  const a = new Date(ts)
  const b = new Date(ref)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Telefono colombiano guardado como +57XXXXXXXXXX: "+57 319 244 5418". Otro formato se muestra tal cual.
export function formatTelefono(t: string): string {
  const m = t.replace(/\D/g, '').match(/^(\d{2})(\d{3})(\d{3})(\d{4})$/)
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : t
}

/** Retiro mínimo de ganancias (el servidor lo vuelve a validar en solicitar_retiro). */
export const RETIRO_MINIMO = 50000

/** Días entre un retiro y el siguiente (el servidor lo vuelve a validar). */
export const RETIRO_CADA_DIAS = 3

/** Cuándo puede volver a retirar: 3 días después de su último retiro no rechazado, o null si ya puede. */
export function proximoRetiro(retiros: { estado: string; creado: number }[], now = Date.now()): number | null {
  const ultimo = Math.max(0, ...retiros.filter((r) => r.estado !== 'rechazado').map((r) => r.creado))
  const next = ultimo + RETIRO_CADA_DIAS * 864e5
  return ultimo && next > now ? next : null
}

/** Deuda de comisiones de efectivo a partir de la cual el profesional no puede conectarse (limite_deuda() en 0021). */
export const LIMITE_DEUDA = 100000

/** "•••• 4567" */
export const enmascarar = (numero: string) => `•••• ${numero.slice(-4)}`
