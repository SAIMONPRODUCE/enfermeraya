import { Home, MapPin } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { KM_PER_DEG_LAT, kmPerDegLng } from '../lib/geo'
import { initials } from '../lib/format'
import type { LatLng } from '../types'

export interface MapMarker {
  id: string
  pos: LatLng
  kind: 'patient' | 'nurse' | 'request' | 'me'
  label?: string
  color?: string
  offline?: boolean
  moving?: boolean
  highlight?: boolean
}

interface Props {
  markers: MapMarker[]
  center?: LatLng
  /** km visibles a lo ancho (si no hay `fit`) */
  kmAcross?: number
  /** Encuadra todos los marcadores automáticamente */
  fit?: boolean
  radiusKm?: number
  routes?: { from: LatLng; to: LatLng }[]
  onPick?: (p: LatLng) => void
  className?: string
}

/** Mapa interactivo ligero (SVG + marcadores HTML) sin dependencias de tiles: funciona offline. */
export function MapView({ markers, center, kmAcross = 10, fit, radiusKm, routes = [], onPick, className = '' }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 360, h: 280 })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 360, h: el.clientHeight || 280 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const view = useMemo(() => {
    const pts = [...markers.map((m) => m.pos), ...routes.flatMap((r) => [r.from, r.to])]
    let c = center ?? pts[0] ?? { lat: 4.711, lng: -74.0721 }
    let across = kmAcross
    if (fit && pts.length) {
      const lats = pts.map((p) => p.lat)
      const lngs = pts.map((p) => p.lng)
      c = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 }
      const spanX = (Math.max(...lngs) - Math.min(...lngs)) * kmPerDegLng(c.lat)
      const spanY = (Math.max(...lats) - Math.min(...lats)) * KM_PER_DEG_LAT
      across = Math.max(1.4, Math.max(spanX, (spanY * size.w) / size.h) * 1.55)
    }
    const pxPerKm = size.w / across
    const project = (p: LatLng) => ({
      x: size.w / 2 + (p.lng - c.lng) * kmPerDegLng(c.lat) * pxPerKm,
      y: size.h / 2 - (p.lat - c.lat) * KM_PER_DEG_LAT * pxPerKm,
    })
    const unproject = (x: number, y: number): LatLng => ({
      lng: c.lng + (x - size.w / 2) / pxPerKm / kmPerDegLng(c.lat),
      lat: c.lat - (y - size.h / 2) / pxPerKm / KM_PER_DEG_LAT,
    })
    return { c, pxPerKm, project, unproject }
  }, [markers, routes, center, kmAcross, fit, size])

  const handle = (e: React.MouseEvent) => {
    if (!onPick || !box.current) return
    const r = box.current.getBoundingClientRect()
    onPick(view.unproject(e.clientX - r.left, e.clientY - r.top))
  }

  const ctr = view.project(view.c)
  return (
    <div
      ref={box}
      onClick={handle}
      className={`relative overflow-hidden bg-[#e7f0f6] ${onPick ? 'cursor-crosshair' : ''} ${className}`}
    >
      <MapBackground ox={ctr.x - size.w / 2} oy={ctr.y - size.h / 2} />

      {radiusKm !== undefined && markers.find((m) => m.kind === 'me' || m.kind === 'patient') && (() => {
        const anchor = markers.find((m) => m.kind === 'me' || m.kind === 'patient')!
        const p = view.project(anchor.pos)
        const r = radiusKm * view.pxPerKm
        return (
          <div
            className="pointer-events-none absolute rounded-full border border-brand-400/50 bg-brand-500/[0.07]"
            style={{ width: r * 2, height: r * 2, left: 0, top: 0, transform: `translate(${p.x - r}px, ${p.y - r}px)`, transition: 'transform 600ms var(--ease-in-out), width 600ms var(--ease-in-out), height 600ms var(--ease-in-out)' }}
          />
        )
      })()}

      {routes.map((r, i) => {
        const a = view.project(r.from)
        const b = view.project(r.to)
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
        return (
          <div
            key={i}
            className="map-line pointer-events-none absolute left-0 top-0 h-1 rounded-full bg-brand-500/70"
            style={{ width: 1, transform: `translate(${a.x}px, ${a.y - 2}px) rotate(${ang}deg) scaleX(${Math.max(len, 1)})` }}
          />
        )
      })}

      {markers.map((m) => {
        const p = view.project(m.pos)
        return (
          <div
            key={m.id}
            className={`map-marker pointer-events-none absolute left-0 top-0 ${m.moving ? 'moving' : ''}`}
            style={{ transform: `translate(${p.x}px, ${p.y}px)`, zIndex: m.kind === 'patient' ? 3 : m.highlight ? 4 : 2 }}
          >
            <Pin m={m} />
          </div>
        )
      })}
    </div>
  )
}

function Pin({ m }: { m: MapMarker }) {
  if (m.kind === 'me')
    return (
      <span className="relative block -translate-x-1/2 -translate-y-1/2">
        <span className="pulse-dot relative block h-4 w-4 rounded-full border-[3px] border-white bg-brand-600 shadow" />
      </span>
    )
  if (m.kind === 'patient')
    return (
      <span className="absolute -translate-x-1/2 -translate-y-full">
        <span className="flex flex-col items-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-ink text-white shadow-lg">
            <Home size={18} />
          </span>
          <span className="-mt-1 h-2 w-2 rotate-45 bg-ink" />
        </span>
      </span>
    )
  if (m.kind === 'request')
    return (
      <span className="absolute -translate-x-1/2 -translate-y-full">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-amber-500 text-white shadow-lg">
          <MapPin size={16} />
        </span>
      </span>
    )
  return (
    <span className="absolute -translate-x-1/2 -translate-y-1/2">
      <span
        className={`flex items-center justify-center rounded-full border-[3px] border-white text-[11px] font-bold text-white shadow-md transition-[width,height] duration-200 ${m.highlight ? 'h-11 w-11 ring-4 ring-mint-400/40' : 'h-8 w-8'} ${m.offline ? 'opacity-50 grayscale' : ''}`}
        style={{ background: m.color ?? '#0ea5a4' }}
      >
        {initials(m.label ?? 'E')}
      </span>
    </span>
  )
}

function MapBackground({ ox, oy }: { ox: number; oy: number }) {
  // Calles/parques/río deterministas; se desplazan con el centro para dar sensación de mapa.
  // Solo cambia el transform del contenedor: el SVG estático (Streets) no se vuelve a renderizar.
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] max-w-none"
      style={{ transform: `translate(calc(-50% - ${ox * 0.5}px), calc(-50% - ${oy * 0.5}px))`, transition: 'transform 600ms var(--ease-in-out)' }}
      aria-hidden
    >
      <Streets />
    </div>
  )
}

const Streets = memo(function Streets() {
  return (
    <svg className="block h-full w-full" viewBox="0 0 900 900">
      <rect width="900" height="900" fill="#e9f1f5" />
      <path d="M-20 640 C 180 560, 260 700, 430 600 S 720 420, 930 470 L930 540 C 740 500, 560 640, 430 690 S 160 640, -20 720 Z" fill="#bcdcf1" />
      <ellipse cx="220" cy="220" rx="110" ry="80" fill="#cfe9d4" />
      <ellipse cx="660" cy="250" rx="90" ry="120" fill="#cfe9d4" />
      <ellipse cx="640" cy="760" rx="80" ry="55" fill="#cfe9d4" />
      <g stroke="#fff" strokeLinecap="round" fill="none">
        <g strokeWidth="2">
          {[60, 140, 230, 310, 380, 470, 560, 640, 720, 800, 860].map((x) => (<line key={'v' + x} x1={x} y1="0" x2={x + 40} y2="900" />))}
          {[40, 110, 190, 270, 350, 420, 520, 610, 700, 780, 850].map((y) => (<line key={'h' + y} x1="0" y1={y} x2="900" y2={y - 30} />))}
        </g>
        <g strokeWidth="9">
          <line x1="140" y1="0" x2="300" y2="900" />
          <line x1="0" y1="420" x2="900" y2="360" />
          <line x1="560" y1="0" x2="470" y2="900" />
          <line x1="0" y1="190" x2="900" y2="250" />
        </g>
      </g>
    </svg>
  )
})
