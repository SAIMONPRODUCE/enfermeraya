export const money = (n: number) => '$ ' + Math.round(n).toLocaleString('es-CO')

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
