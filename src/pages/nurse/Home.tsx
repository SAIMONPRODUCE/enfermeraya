import { Check, Clock, FileCheck2, MapPin, Navigation, Wallet, X, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MapView } from '../../components/MapView'
import { Sheet } from '../../components/Sheet'
import { Avatar, Button, Card, ServiceIcon, Stars, Switch } from '../../components/ui'
import { formatKm, haversine } from '../../lib/geo'
import { isSameDay, money } from '../../lib/format'
import { useApp } from '../../store/AppContext'
import { OFFER_TTL, isActive, serviceOf } from '../../store/sim'
import type { Servicio } from '../../types'

function useNow(ms: number) {
  const [n, setN] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return n
}

function Pending() {
  const { me, myNurse } = useApp()
  const rejected = myNurse?.aprobado_por_admin === 'rechazado'
  return (
    <div className="scroll-y h-full px-5 pb-6">
      <div className="stagger flex flex-col items-center gap-4 pt-8 text-center">
        <span style={{ ['--i' as string]: 0 }} className={`flex h-24 w-24 items-center justify-center rounded-full ${rejected ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
          {rejected ? <X size={44} /> : <Clock size={44} />}
        </span>
        <h1 style={{ ['--i' as string]: 1 }} className="text-2xl font-extrabold">{rejected ? 'Documentación rechazada' : 'Perfil en revisión'}</h1>
        <p style={{ ['--i' as string]: 2 }} className="max-w-[300px] text-mute">
          {rejected ? 'Revisa tus documentos y contacta a soporte para volver a enviarlos.' : `Hola ${me?.nombre.split(' ')[0]}, un administrador está validando tu tarjeta profesional y diploma. Te avisaremos apenas esté listo.`}
        </p>
        <Card className="w-full text-left" >
          <p className="mb-2 text-[13px] font-bold text-mute">Documentos enviados</p>
          {myNurse?.documentos_url.map((d) => (
            <p key={d} className="flex items-center gap-2 py-1 text-[14px] font-semibold"><FileCheck2 size={18} className="text-brand-600" />{d}</p>
          ))}
        </Card>
        <p className="text-[13px] text-mute">💡 Demo: entra como Admin para aprobar este perfil.</p>
      </div>
    </div>
  )
}

function OfferSheet({ s }: { s: Servicio }) {
  const { me, state, accept, reject } = useApp()
  const now = useNow(250)
  const svc = serviceOf(s.servicio_id)
  const left = Math.max(0, OFFER_TTL - (now - s.oferta_inicio))
  const frac = left / OFFER_TTL
  const dist = haversine(me!.ubicacion, s.ubicacion_paciente)
  const patient = state.users.find((u) => u.id === s.paciente_id)
  const R = 26
  const C = 2 * Math.PI * R
  return (
    <Sheet open onClose={() => {}} dismissible={false} title="Nueva solicitud">
      <div className="space-y-4 pb-2">
        <div className="flex items-center gap-3">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={R} fill="none" stroke="#e2e8f0" strokeWidth="5" />
              <circle cx="32" cy="32" r={R} fill="none" stroke={frac < 0.3 ? '#ef4444' : '#1d6fe8'} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset 250ms linear, stroke 300ms ease' }} />
            </svg>
            <span className="text-lg font-extrabold tabular-nums">{Math.ceil(left / 1000)}</span>
          </span>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-wide text-amber-600">Nueva solicitud</p>
            <h2 className="text-xl font-extrabold leading-tight">{svc.nombre}</h2>
          </div>
        </div>
        <MapView className="h-36 rounded-3xl" fit markers={[{ id: 'me', pos: me!.ubicacion, kind: 'me' }, { id: 'p', pos: s.ubicacion_paciente, kind: 'patient' }]} routes={[{ from: me!.ubicacion, to: s.ubicacion_paciente }]} />
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="!p-3"><p className="text-[12px] text-mute">Distancia</p><p className="font-extrabold">{formatKm(dist)}</p></Card>
          <Card className="!p-3"><p className="text-[12px] text-mute">Pago</p><p className="font-extrabold text-mint-600">{money(s.total * 0.85)}</p></Card>
          <Card className="!p-3"><p className="text-[12px] text-mute">Cuándo</p><p className="font-extrabold">{s.inmediato ? 'Ahora' : 'Prog.'}</p></Card>
        </div>
        <div className="text-[14px]">
          <p className="flex items-center gap-2 font-semibold"><MapPin size={16} className="text-brand-600" />{s.direccion}</p>
          {patient && <p className="mt-1 text-mute">Paciente: {patient.nombre}</p>}
          {s.notas && <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-mute">“{s.notas}”</p>}
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Button variant="ghost" onClick={() => reject(s.id)}>Rechazar</Button>
          <Button variant="mint" onClick={() => accept(s.id)}><Check size={18} /> Aceptar servicio</Button>
        </div>
      </div>
    </Sheet>
  )
}

export default function NurseHome() {
  const { me, myNurse, state, toggleOnline, advance, demoRequest } = useApp()
  if (!me || !myNurse) return null
  if (myNurse.aprobado_por_admin !== 'aprobado') return <Pending />

  const offer = state.servicios.find((s) => s.estado === 'solicitado' && s.candidato === me.id)
  const active = state.servicios.find((s) => s.enfermero_id === me.id && isActive(s))
  const done = state.servicios.filter((s) => s.enfermero_id === me.id && s.estado === 'completado')
  const doneToday = done.filter((s) => isSameDay(s.estado_ts))
  const today = doneToday.reduce((a, s) => a + s.total * 0.85, 0)

  const btn = active
    ? active.estado === 'aceptado' ? { label: 'Salir hacia el paciente', icon: Navigation }
    : active.estado === 'en_camino' && !active.llego ? { label: 'Llegué', icon: MapPin }
    : active.estado === 'en_camino' ? { label: 'Iniciar procedimiento', icon: Zap }
    : { label: 'Terminé servicio', icon: Check }
    : null

  return (
    <div className="scroll-y h-full px-5 pb-6">
      <div className="stagger space-y-4">
        <Card className={`flex items-center gap-4 transition-colors duration-300 ${myNurse.online ? '!bg-mint-500 !text-white' : ''}`} >
          <div className="flex-1">
            <p className={`text-[13px] font-semibold ${myNurse.online ? 'text-white/80' : 'text-mute'}`}>Estás</p>
            <p className="text-2xl font-extrabold">{myNurse.online ? 'Conectado' : 'Desconectado'}</p>
            <p className={`text-[13px] ${myNurse.online ? 'text-white/80' : 'text-mute'}`}>{myNurse.online ? 'Recibiendo solicitudes cercanas' : 'Conéctate para recibir servicios'}</p>
          </div>
          <Switch on={myNurse.online} onChange={toggleOnline} label="Conectado" />
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card className="!p-3 text-center"><p className="text-[12px] text-mute">Hoy</p><p className="text-[15px] font-extrabold">{money(today)}</p></Card>
          <Card className="!p-3 text-center"><p className="text-[12px] text-mute">Servicios</p><p className="text-[15px] font-extrabold">{myNurse.servicios}</p></Card>
          <Card className="!p-3 text-center"><p className="text-[12px] text-mute">Calificación</p><p className="text-[15px]"><Stars value={me.calificacion} size={15} /></p></Card>
        </div>

        {active ? (
          <Card key={active.estado + active.llego} className="pop-enter space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><ServiceIcon name={serviceOf(active.servicio_id).icon} /></span>
              <div className="min-w-0 flex-1"><p className="text-[12px] font-bold uppercase text-brand-600">Servicio activo</p><p className="truncate font-extrabold">{serviceOf(active.servicio_id).nombre}</p></div>
              <span className="font-extrabold text-mint-600">{money(active.total * 0.85)}</span>
            </div>
            <MapView className="h-44 rounded-2xl" fit
              markers={[{ id: 'me', pos: active.nursePos ?? me.ubicacion, kind: 'me', moving: true }, { id: 'p', pos: active.ubicacion_paciente, kind: 'patient' }]}
              routes={active.llego ? [] : [{ from: active.nursePos ?? me.ubicacion, to: active.ubicacion_paciente }]} />
            <p className="flex items-center gap-2 text-[14px] font-semibold"><MapPin size={16} className="text-brand-600" />{active.direccion}</p>
            {active.notas && <p className="rounded-2xl bg-slate-50 p-3 text-[13px] text-mute">“{active.notas}”</p>}
            {btn && <Button block onClick={() => advance(active.id)} variant={btn.label === 'Terminé servicio' ? 'mint' : 'primary'}><btn.icon size={18} /> {btn.label}</Button>}
          </Card>
        ) : (
          <Card className="space-y-3">
            <MapView className="h-52 rounded-2xl" center={me.ubicacion} kmAcross={11} radiusKm={5} markers={[{ id: 'me', pos: me.ubicacion, kind: 'me' }]} />
            {myNurse.online ? (
              <div className="flex items-center gap-3">
                <span className="relative h-3 w-3 shrink-0"><span className="pulse-dot relative block h-3 w-3 rounded-full bg-mint-500" /></span>
                <p className="flex-1 text-[14px] font-semibold">Buscando servicios cerca de ti…</p>
              </div>
            ) : (
              <p className="text-center text-[14px] text-mute">Activa el interruptor para aparecer en el mapa de los pacientes.</p>
            )}
            {myNurse.online && <Button block variant="soft" onClick={demoRequest}><Zap size={18} /> Simular solicitud cercana</Button>}
          </Card>
        )}

        {doneToday.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-[17px] font-extrabold"><Wallet size={18} /> Completados hoy</h2>
            <div className="space-y-2">
              {doneToday.slice(0, 3).map((s) => (
                <Card key={s.id} className="flex items-center gap-3 !p-3">
                  <Avatar name={state.users.find((u) => u.id === s.paciente_id)?.nombre ?? 'P'} color="#1d6fe8" size={38} />
                  <span className="flex-1 truncate font-semibold">{serviceOf(s.servicio_id).nombre}</span>
                  <span className="font-extrabold text-mint-600">+{money(s.total * 0.85)}</span>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
      {offer && <OfferSheet key={offer.id + offer.oferta_inicio} s={offer} />}
    </div>
  )
}
