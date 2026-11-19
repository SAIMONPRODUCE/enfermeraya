import { ArrowRight, ChevronDown, MapPin, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LocationSheet } from '../../components/LocationSheet'
import { MapView } from '../../components/MapView'
import { Avatar, Card, ESTADO_LABEL, ServiceTile, StatusPill, Stars, Validated } from '../../components/ui'
import { OFERTA } from '../../data/seed'
import { formatKm } from '../../lib/geo'
import { money } from '../../lib/format'
import { useApp } from '../../store/AppContext'
import { availableNurses, desde, isActive, serviceOf } from '../../store/sim'

export default function PatientHome() {
  const { me, state } = useApp()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState(false)
  if (!me) return null

  const active = state.servicios.find((s) => s.paciente_id === me.id && isActive(s))
  const near = availableNurses(state, me.ubicacion, [], 10)
  const list = OFERTA.filter((c) => c.nombre.toLowerCase().includes(q.toLowerCase()))
  const first = me.nombre.split(' ')[0]
  const closest = near[0]

  return (
    <div className="scroll-y h-full pb-8">
      <div className="stagger space-y-7 px-5 pt-2">
        <div>
          <p className="text-[15px] text-mute">Hola, <span className="capitalize">{first}</span></p>
          <h1 className="mt-0.5 text-[28px] font-extrabold leading-[1.12] tracking-tight text-balance">¿Qué cuidado necesitas hoy?</h1>
          <button onClick={() => setLoc(true)} className="press mt-4 flex max-w-full items-center gap-2 rounded-full bg-white py-2.5 pl-3.5 pr-4 shadow-[0_1px_2px_rgba(15,31,61,0.06),0_12px_24px_-14px_rgba(20,48,95,0.3)]">
            <MapPin size={16} className="shrink-0 text-brand-600" />
            <span className="truncate text-[14px] font-semibold">{me.direccion || 'Elegir ubicación'}</span>
            <ChevronDown size={16} className="shrink-0 text-mute" />
          </button>
        </div>

        {active && (
          <button onClick={() => nav(`/p/seguimiento/${active.id}`)} className="press w-full text-left">
            <Card className="flex items-center gap-3 !bg-brand-600 !text-white">
              <span className="relative flex h-3 w-3 shrink-0"><span className="pulse-dot relative h-3 w-3 rounded-full bg-mint-400" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">{serviceOf(active.servicio_id).nombre}</span>
                <span className="block text-[13px] text-white/85">{ESTADO_LABEL[active.estado]} · ver seguimiento</span>
              </span>
              <ArrowRight size={20} className="shrink-0" />
            </Card>
          </button>
        )}

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            enterKeyHint="search"
            aria-label="Buscar servicio"
            placeholder="Buscar: inyección, curación…"
            className="h-[52px] w-full rounded-2xl border border-transparent bg-white pl-11 pr-4 shadow-[0_1px_2px_rgba(15,31,61,0.06),0_12px_24px_-14px_rgba(20,48,95,0.3)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-500 focus:border-brand-500 focus:shadow-[0_0_0_4px_rgba(42,116,238,0.12)]"
          />
        </div>

        <section>
          <h2 className="mb-3 text-[18px] font-extrabold tracking-tight">Servicios</h2>
          {list.length === 0 ? (
            <p className="rounded-3xl bg-white p-6 text-center text-mute">No encontramos “{q}”. Prueba con otra palabra.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {list.map((c) => (
                <button key={c.id} onClick={() => nav(`/p/solicitar?s=${c.id}`)} className="press lift text-left">
                  <Card className="flex h-full flex-col">
                    <ServiceTile id={c.id} icon={c.icon} />
                    <span className="mt-3.5 block text-[16px] font-bold leading-tight">{c.nombre}</span>
                    <span className="mt-1 block text-[13px] text-mute">{c.duracion}</span>
                    <span className="mt-3 block text-[13px] text-mute">Desde <b className="text-[15px] font-bold text-ink">{money(desde(state, near, c.id))}</b></span>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[18px] font-extrabold tracking-tight">Cerca de ti</h2>
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-mint-700">
              <span className="relative h-2 w-2"><span className="pulse-dot relative block h-2 w-2 rounded-full bg-mint-500" /></span>
              {near.length} {near.length === 1 ? 'disponible' : 'disponibles'}
            </span>
          </div>

          {closest ? (
            <Card className="mb-3 overflow-hidden !p-0">
              <button onClick={() => nav(`/p/solicitar?e=${closest.user.id}`)} className="press flex w-full items-center gap-3.5 p-4 text-left">
                <Avatar name={closest.user.nombre} color={closest.user.color} size={52} online />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold leading-tight">{closest.user.nombre}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-mute">{closest.detail.especialidad}</span>
                  <span className="mt-1 flex items-center gap-2 text-[13px]"><Stars value={closest.user.calificacion} size={13} /><span className="text-mute">· a {formatKm(closest.dist)}</span></span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-mute" />
              </button>
              <Validated />
            </Card>
          ) : (
            <p className="mb-3 rounded-3xl bg-white p-5 text-[14px] text-mute">Ahora no hay profesionales conectados a menos de 10 km. Vuelve a intentar en unos minutos.</p>
          )}

          <MapView
            className="h-44 rounded-3xl"
            center={me.ubicacion}
            kmAcross={11}
            radiusKm={5}
            markers={[
              { id: 'me', pos: me.ubicacion, kind: 'me' },
              ...near.map((c) => ({ id: c.user.id, pos: c.user.ubicacion, kind: 'nurse' as const, label: c.user.nombre, color: c.user.color })),
            ]}
          />

          {near.length > 1 && (
            <div className="-mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-1 scroll-y">
              {near.slice(1, 6).map((c) => (
                <button key={c.user.id} onClick={() => nav(`/p/solicitar?e=${c.user.id}`)} className="press w-60 shrink-0 snap-start text-left">
                  <Card className="flex items-center gap-3 !p-3">
                    <Avatar name={c.user.nombre} color={c.user.color} online />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold">{c.user.nombre}</span>
                      <span className="block truncate text-[13px] text-mute">{c.detail.especialidad}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[13px]"><Stars value={c.user.calificacion} size={12} /><span className="text-mute">· {formatKm(c.dist)}</span></span>
                    </span>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      <LocationSheet open={loc} onClose={() => setLoc(false)} />
    </div>
  )
}

export { StatusPill }
