import { useEffect, useRef } from 'react'
import type * as Leaflet from 'leaflet'
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

// ponytail: mosaicos de OpenStreetMap, solo para desarrollo y pruebas (su política no admite tráfico de producción).
// Antes de publicar: definir VITE_TILE_URL (y VITE_TILE_ATTRIBUTION) con un proveedor con llave: MapTiler, Stadia, Mapbox.
const TILE_URL = import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION ?? '© OpenStreetMap'
const DEFAULT_CENTER: LatLng = { lat: 4.711, lng: -74.0721 }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// Iconos de lucide (Home, MapPin) en línea: el marcador es HTML de Leaflet, no un árbol de React.
const HOME_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'
const PIN_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>'

/** HTML + ancla de cada tipo de marcador. */
function pinOf(m: MapMarker): { html: string; size: [number, number]; anchor: [number, number] } {
  if (m.kind === 'me')
    return { html: '<span class="pulse-dot relative block h-4 w-4 rounded-full border-[3px] border-white bg-brand-600 shadow"></span>', size: [16, 16], anchor: [8, 8] }
  if (m.kind === 'patient')
    return {
      html: `<span class="flex flex-col items-center"><span class="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-ink text-white shadow-lg">${HOME_SVG}</span><span class="-mt-1 h-2 w-2 rotate-45 bg-ink"></span></span>`,
      size: [40, 50], anchor: [20, 50],
    }
  if (m.kind === 'request')
    return { html: `<span class="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-amber-500 text-white shadow-lg">${PIN_SVG}</span>`, size: [36, 36], anchor: [18, 36] }
  const d = m.highlight ? 44 : 32
  return {
    html: `<span class="flex items-center justify-center rounded-full border-[3px] border-white text-[12px] font-bold text-white shadow-md ${m.highlight ? 'ring-4 ring-mint-400/40' : ''} ${m.offline ? 'opacity-50 grayscale' : ''}" style="width:${d}px;height:${d}px;background:${esc(m.color ?? '#0ea5a4')}">${esc(initials(m.label ?? 'E'))}</span>`,
    size: [d, d], anchor: [d / 2, d / 2],
  }
}

/** Zoom que deja `km` visibles a lo ancho de `px` píxeles a la latitud dada. */
const zoomFor = (km: number, px: number, lat: number) => Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180) * px) / (km * 1000))

interface Live {
  L: typeof Leaflet
  map: Leaflet.Map
  pins: Map<string, { marker: Leaflet.Marker; key: string }>
  layer: Leaflet.LayerGroup
  /** Huella de la última vista aplicada: la vista solo se anima cuando cambia lo que la determina. */
  view: string
}

/** Mapa de calles reales (Leaflet, cargado bajo demanda). Marcadores, radio y ruta se sincronizan con las props. */
export function MapView({ markers, center, kmAcross = 10, fit, radiusKm, routes = [], onPick, className = '' }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const live = useRef<Live | null>(null)
  const latest = useRef({ markers, center, kmAcross, fit, radiusKm, routes, onPick })
  latest.current = { markers, center, kmAcross, fit, radiusKm, routes, onPick }

  // Pinta marcadores, radio y rutas y encuadra la vista a partir de las props más recientes.
  const sync = useRef(() => {})
  sync.current = () => {
    const lv = live.current
    if (!lv) return
    const { L, map, pins, layer } = lv
    const { markers: ms, center: c, kmAcross: km, fit: doFit, radiusKm: rKm, routes: rs } = latest.current

    // Marcadores: se reutilizan por id; moverlos anima con CSS (clase ey-glide) para un desplazamiento continuo.
    const seen = new Set<string>()
    for (const m of ms) {
      seen.add(m.id)
      const key = `${m.kind}|${m.color}|${m.offline}|${m.highlight}|${m.label}`
      const cur = pins.get(m.id)
      const z = m.kind === 'patient' ? 300 : m.highlight ? 400 : 200
      if (!cur) {
        const p = pinOf(m)
        const marker = L.marker([m.pos.lat, m.pos.lng], {
          icon: L.divIcon({ html: p.html, className: `ey-pin${m.moving ? ' ey-glide' : ''}`, iconSize: p.size, iconAnchor: p.anchor }),
          interactive: false, keyboard: false, zIndexOffset: z,
        }).addTo(map)
        pins.set(m.id, { marker, key })
      } else {
        cur.marker.setLatLng([m.pos.lat, m.pos.lng])
        if (cur.key !== key) {
          const p = pinOf(m)
          cur.marker.setIcon(L.divIcon({ html: p.html, className: `ey-pin${m.moving ? ' ey-glide' : ''}`, iconSize: p.size, iconAnchor: p.anchor }))
          cur.key = key
        }
        const el = cur.marker.getElement()
        if (el) el.classList.toggle('ey-glide', !!m.moving)
      }
    }
    for (const [id, p] of pins) if (!seen.has(id)) { p.marker.remove(); pins.delete(id) }

    // Radio y rutas se redibujan: son pocos elementos.
    layer.clearLayers()
    const anchor = ms.find((m) => m.kind === 'me' || m.kind === 'patient')
    if (rKm !== undefined && anchor)
      L.circle([anchor.pos.lat, anchor.pos.lng], { radius: rKm * 1000, color: '#2a74ee', weight: 1, opacity: 0.5, fillColor: '#2a74ee', fillOpacity: 0.07, interactive: false }).addTo(layer)
    for (const r of rs)
      L.polyline([[r.from.lat, r.from.lng], [r.to.lat, r.to.lng]], { color: '#2a74ee', weight: 4, opacity: 0.7, lineCap: 'round', interactive: false }).addTo(layer)

    // Vista: con `fit` encuadra todos los puntos; si no, centro y escala por km a lo ancho.
    const pts = [...ms.map((m) => m.pos), ...rs.flatMap((r) => [r.from, r.to])]
    const round = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
    const view = doFit && pts.length ? `fit|${pts.map(round).join(';')}` : `set|${round(c ?? pts[0] ?? DEFAULT_CENTER)}|${km}`
    if (view === lv.view) return
    lv.view = view
    if (doFit && pts.length) {
      map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [56, 56], maxZoom: 17, animate: true, duration: 0.6 })
    } else {
      const ctr = c ?? pts[0] ?? DEFAULT_CENTER
      map.setView([ctr.lat, ctr.lng], Math.round(zoomFor(km, map.getSize().x || 360, ctr.lat)), { animate: true, duration: 0.6 }) // zoom entero: mosaicos nítidos, sin líneas entre ellos
    }
  }

  useEffect(() => {
    const el = box.current
    if (!el) return
    let dead = false
    let ro: ResizeObserver | undefined
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
      if (dead) return
      const L = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet)
      // Sin gestos: el mapa acompaña la pantalla (el scroll de la página sigue funcionando). Solo se toca para elegir un punto.
      const map = L.map(el, {
        zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        boxZoom: false, keyboard: false, touchZoom: false, center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], zoom: 13,
      })
      L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map)
      L.control.attribution({ position: 'topright', prefix: false }).addAttribution(TILE_ATTRIBUTION).addTo(map)
      map.on('click', (e: Leaflet.LeafletMouseEvent) => latest.current.onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
      live.current = { L, map, pins: new Map(), layer: L.layerGroup().addTo(map), view: '' }
      ro = new ResizeObserver(() => {
        map.invalidateSize()
        if (live.current) live.current.view = '' // el tamaño cambió: reencuadrar
        sync.current()
      })
      ro.observe(el)
      sync.current()
    })
    return () => {
      dead = true
      ro?.disconnect()
      live.current?.map.remove()
      live.current = null
    }
  }, [])

  // Cada cambio de props vuelve a sincronizar (no-op mientras Leaflet carga).
  useEffect(() => sync.current())

  return <div ref={box} className={`relative overflow-hidden bg-[#e7f0f6] ${onPick ? 'cursor-crosshair' : ''} ${className}`} />
}
