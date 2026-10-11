import { ChevronDown, MapPin, Search, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LocationSheet } from '../../components/LocationSheet'
import { MapView } from '../../components/MapView'
import { Avatar, Card, ServiceIcon, StatusPill, Stars } from '../../components/ui'
import { CATALOGO } from '../../data/seed'
import { formatKm } from '../../lib/geo'
import { money } from '../../lib/format'
import { useApp } from '../../store/AppContext'
import { availableNurses, isActive, serviceOf } from '../../store/sim'

export default function PatientHome() {
  const { me, state } = useApp()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState(false)
  if (!me) return null

  const active = state.servicios.find((s) => s.paciente_id === me.id && isActive(s))
  const near = availableNurses(state, me.ubicacion, [], 10)
  const list = CATALOGO.filter((c) => c.nombre.toLowerCase().includes(q.toLowerCase()))
  const first = me.nombre.split(' ')[0]

  return (
    <div className="scroll-y h-full pb-6">
      <div className="stagger space-y-5 px-5 pt-1">
        <div style={{ ['--i' as string]: 0 }}>
          <p className="text-[15px] text-mute">Hola, {first} 👋</p>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">¿Qué cuidado necesitas hoy?</h1>
          <button onClick={() => setLoc(true)} className="press mt-3 flex max-w-full items-center gap-2 rounded-full bg-white py-2 pl-3 pr-3.5 shadow-sm">
            <MapPin size={16} className="shrink-0 text-brand-600" />
            <span className="truncate text-[14px] font-semibold">{me.direccion || 'Elegir ubicación'}</span>
            <ChevronDown size={16} className="shrink-0 text-mute" />
          </button>
        </div>

        {active && (
          <button style={{ ['--i' as string]: 1 }} onClick={() => nav(`/p/seguimiento/${active.id}`)} className="press w-full text-left">
            <Card className="flex items-center gap-3 !bg-brand-600 !text-white">
              <span className="relative flex h-3 w-3"><span className="pulse-dot relative h-3 w-3 rounded-full bg-mint-400" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-white/75">Servicio en curso</span>
                <span className="block truncate font-bold">{serviceOf(active.servicio_id).nombre}</span>
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-bold">Ver seguimiento</span>
            </Card>
          </button>
        )}

        <div className="relative" style={{ ['--i' as string]: 2 }}>
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            enterKeyHint="search"
            aria-label="Buscar servicio"
            placeholder="Buscar servicio: inyección, curación…"
            className="h-12 w-full rounded-2xl border border-transparent bg-white pl-11 pr-4 shadow-sm outline-none transition-[border-color,box-shadow] duration-150 focus:border-brand-500 focus:shadow-[0_0_0_4px_rgba(42,116,238,0.12)]"
          />
        </div>

        <section style={{ ['--i' as string]: 3 }}>
          <h2 className="mb-3 text-[17px] font-extrabold">Servicios</h2>
          {list.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-mute">No encontramos “{q}”. Prueba con otra palabra.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {list.map((c) => (
                <button key={c.id} onClick={() => nav(`/p/solicitar?s=${c.id}`)} className="press lift text-left">
                  <Card className="h-full">
                    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                      <ServiceIcon name={c.icon} />
                    </span>
                    <span className="block text-[15px] font-bold leading-tight">{c.nombre}</span>
                    <span className="mt-0.5 block text-[13px] text-mute">Desde {money(c.precio_base)}</span>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={{ ['--i' as string]: 4 }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-extrabold">Cerca de ti</h2>
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-mint-600">
              <span className="relative h-2 w-2"><span className="pulse-dot relative block h-2 w-2 rounded-full bg-mint-500" /></span>
              {near.length} disponibles
            </span>
          </div>
          <MapView
            className="mb-3 h-40 rounded-3xl"
            center={me.ubicacion}
            kmAcross={11}
            radiusKm={5}
            markers={[
              { id: 'me', pos: me.ubicacion, kind: 'me' },
              ...state.users.filter((u) => u.rol === 'enfermero' && state.nurses[u.id]?.aprobado_por_admin === 'aprobado').map((u) => ({ id: u.id, pos: u.ubicacion, kind: 'nurse' as const, label: u.nombre, color: u.color, offline: !state.nurses[u.id].online })),
            ]}
          />
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 scroll-y snap-x">
            {near.slice(0, 6).map((c) => (
              <button key={c.user.id} onClick={() => nav('/p/solicitar')} className="press w-56 shrink-0 snap-start text-left">
                <Card className="flex items-center gap-3 !p-3">
                  <Avatar name={c.user.nombre} color={c.user.color} online />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold">{c.user.nombre}</span>
                    <span className="block truncate text-[12px] text-mute">{c.detail.especialidad}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[12px]"><Stars value={c.user.calificacion} size={12} /><span className="text-mute">· {formatKm(c.dist)}</span></span>
                  </span>
                </Card>
              </button>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-3 rounded-3xl bg-mint-50 p-4 text-mint-600" style={{ ['--i' as string]: 5 }}>
          <ShieldCheck size={26} className="shrink-0" />
          <p className="text-[13px] font-semibold leading-snug text-ink/80">Cada profesional debe ser aprobado por un administrador antes de recibir servicios.</p>
        </div>
      </div>
      <LocationSheet open={loc} onClose={() => setLoc(false)} />
    </div>
  )
}

export { StatusPill }
