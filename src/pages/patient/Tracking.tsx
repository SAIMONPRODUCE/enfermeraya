import { ArrowLeft, Check, MessageCircle, Phone, Star } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapView, type MapMarker } from '../../components/MapView'
import { Avatar, Button, Card, Confetti, Stars, SuccessMark, inputCls } from '../../components/ui'
import { etaMinutes, formatKm, haversine } from '../../lib/geo'
import { money } from '../../lib/format'
import { useApp } from '../../store/AppContext'
import { serviceOf } from '../../store/sim'
import type { Estado } from '../../types'

const STEPS: { id: Estado; label: string }[] = [
  { id: 'solicitado', label: 'Solicitado' },
  { id: 'aceptado', label: 'Aceptado' },
  { id: 'en_camino', label: 'En camino' },
  { id: 'en_atencion', label: 'Atención' },
  { id: 'completado', label: 'Listo' },
]

export function Stepper({ estado }: { estado: Estado }) {
  const idx = STEPS.findIndex((s) => s.id === estado)
  return (
    <div className="relative px-2">
      <div className="absolute left-[10%] right-[10%] top-[11px] h-1 rounded-full bg-slate-200">
        <div className="progress-fill h-full w-full rounded-full bg-brand-600" style={{ transform: `scaleX(${Math.max(0, idx) / (STEPS.length - 1)})`, transitionDuration: '500ms', transitionTimingFunction: 'var(--ease-in-out)' }} />
      </div>
      <div className="relative grid grid-cols-5">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-col items-center gap-1.5">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white transition-[background-color,transform] duration-300 ${i <= idx ? 'bg-brand-600' : 'bg-slate-200'} ${i === idx && estado !== 'completado' ? 'scale-110 ring-4 ring-brand-200' : ''}`}>
              {i < idx || estado === 'completado' ? <Check size={13} strokeWidth={3.5} /> : null}
            </span>
            <span className={`text-[11px] font-semibold transition-colors duration-300 ${i <= idx ? 'text-ink' : 'text-mute'}`}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Tracking() {
  const { id } = useParams()
  const nav = useNavigate()
  const { state, cancel, rate } = useApp()
  const s = state.servicios.find((x) => x.id === id)
  const [stars, setStars] = useState(0)
  const [review, setReview] = useState('')
  if (!s) return <div className="p-8 text-center text-mute">Servicio no encontrado.</div>

  const nurse = state.users.find((u) => u.id === s.enfermero_id)
  const detail = nurse ? state.nurses[nurse.id] : null
  const svc = serviceOf(s.servicio_id)
  const searching = s.estado === 'solicitado'
  const candidate = state.users.find((u) => u.id === s.candidato)
  const dist = s.nursePos ? haversine(s.nursePos, s.ubicacion_paciente) : 0

  const markers: MapMarker[] = [{ id: 'p', pos: s.ubicacion_paciente, kind: 'patient' }]
  if (nurse && s.nursePos && s.estado !== 'cancelado')
    markers.push({ id: nurse.id, pos: s.nursePos, kind: 'nurse', label: nurse.nombre, color: nurse.color, moving: s.estado === 'en_camino', highlight: true })
  const showRoute = s.nursePos && s.estado === 'en_camino' && !s.llego

  const headline =
    s.estado === 'aceptado' ? `${nurse?.nombre.split(' ')[0]} se prepara para salir`
    : s.estado === 'en_camino' ? (s.llego ? '¡Tu enfermero llegó!' : `Llega en ~${etaMinutes(dist)} min`)
    : s.estado === 'en_atencion' ? 'Atención en curso'
    : ''

  // absolute inset-0 (no h-full): llena <main> aunque el alto en % no se resuelva al cargar la URL directo
  return (
    <div className="absolute inset-0">
      <MapView
        className="absolute inset-0"
        fit
        radiusKm={undefined}
        markers={markers}
        routes={showRoute ? [{ from: s.nursePos!, to: s.ubicacion_paciente }] : []}
        center={s.ubicacion_paciente}
        kmAcross={4}
      />
      {searching && (
        <div className="pointer-events-none absolute inset-x-0 top-[12%] flex h-[40%] items-center justify-center">
          {[0, 0.8, 1.6].map((d) => (
            <span key={d} className="radar-ring absolute h-72 w-72 rounded-full border-2 border-brand-500/60 bg-brand-500/10" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      )}
      <button onClick={() => nav('/p', { replace: true })} aria-label="Volver al inicio" className="press absolute left-4 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg"><ArrowLeft size={20} /></button>

      <div className="safe-bottom pop-enter absolute inset-x-0 bottom-0 z-10 max-h-[75%] overflow-y-auto rounded-t-[28px] bg-white px-5 pt-5 shadow-[0_-12px_40px_-12px_rgba(15,31,61,0.3)] scroll-y">
        {searching && (
          <div className="space-y-4 pb-4">
            <div>
              <h2 className="text-xl font-extrabold">Buscando tu enfermero…</h2>
              <p className="text-[14px] text-mute" key={s.candidato ?? 'x'}>
                {candidate ? <span className="step-enter inline-block">Consultando a <b className="text-ink">{candidate.nombre}</b> · espera la respuesta</span> : 'Encontrando al profesional más cercano'}
              </p>
            </div>
            <div className="shimmer h-1.5 rounded-full" />
            <Stepper estado={s.estado} />
            <Button block variant="danger" onClick={() => { cancel(s.id); nav('/p', { replace: true }) }}>Cancelar solicitud</Button>
          </div>
        )}

        {(s.estado === 'aceptado' || s.estado === 'en_camino' || s.estado === 'en_atencion') && nurse && detail && (
          <div className="space-y-4 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold" key={headline}><span className="step-enter inline-block">{headline}</span></h2>
              {s.estado === 'en_camino' && !s.llego && <span className="rounded-full bg-brand-50 px-3 py-1 text-[13px] font-bold text-brand-700">{formatKm(dist)}</span>}
            </div>
            <Stepper estado={s.estado} />
            <Card className="flex items-center gap-3 !bg-slate-50 !p-3 !shadow-none">
              <Avatar name={nurse.nombre} color={nurse.color} size={52} online />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{nurse.nombre}</span>
                <span className="block truncate text-[13px] text-mute">{detail.especialidad}</span>
                <span className="text-[13px]"><Stars value={nurse.calificacion} /> <span className="text-mute">· {detail.servicios} servicios</span></span>
              </span>
              <a href={`tel:${nurse.telefono}`} aria-label="Llamar" className="press flex h-11 w-11 items-center justify-center rounded-full bg-mint-500 text-white"><Phone size={18} /></a>
              <a href={`sms:${nurse.telefono}`} aria-label="Mensaje" className="press flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white"><MessageCircle size={18} /></a>
            </Card>
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-mute">{svc.nombre} · {s.direccion}</span>
              <span className="font-extrabold">{money(s.total)}</span>
            </div>
            {(s.estado === 'aceptado') && <Button block variant="danger" onClick={() => { cancel(s.id); nav('/p', { replace: true }) }}>Cancelar servicio</Button>}
          </div>
        )}

        {s.estado === 'completado' && (
          <div className="relative space-y-4 pb-4 text-center">
            <div className="relative flex justify-center pt-1">{s.calificacion === null && <Confetti />}<SuccessMark size={72} /></div>
            <div>
              <h2 className="text-xl font-extrabold">¡Servicio completado!</h2>
              <p className="text-[14px] text-mute">{svc.nombre} · {money(s.total)}</p>
            </div>
            {s.calificacion === null ? (
              <div className="space-y-3 text-left">
                <p className="text-center font-bold">¿Cómo fue la atención de {nurse?.nombre.split(' ')[0]}?</p>
                <div className="flex justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setStars(n)} aria-label={`${n} estrellas`} className="press p-1">
                      <Star size={38} className={`transition-[color,fill,transform] duration-200 ${n <= stars ? 'scale-110 fill-amber-400 text-amber-400' : 'fill-transparent text-slate-300'}`} />
                    </button>
                  ))}
                </div>
                {stars > 0 && (
                  <div className="step-enter space-y-3">
                    <textarea className={inputCls + ' h-20 resize-none py-3'} placeholder="Deja una reseña (opcional)" value={review} onChange={(e) => setReview(e.target.value)} />
                    <Button block onClick={() => rate(s.id, stars, review)}>Enviar calificación</Button>
                  </div>
                )}
                <button onClick={() => nav('/p', { replace: true })} className="press w-full py-2 text-[14px] font-semibold text-mute">Ahora no</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-bold text-mint-600">¡Gracias por calificar! {'★'.repeat(s.calificacion)}</p>
                <Button block onClick={() => nav('/p', { replace: true })}>Volver al inicio</Button>
              </div>
            )}
          </div>
        )}

        {(s.estado === 'cancelado' || s.estado === 'sin_cobertura') && (
          <div className="space-y-4 pb-4 text-center">
            <h2 className="text-xl font-extrabold">{s.estado === 'cancelado' ? 'Solicitud cancelada' : 'Sin enfermeros disponibles'}</h2>
            <p className="text-[14px] text-mute">{s.estado === 'cancelado' ? 'No se hizo ningún cobro.' : 'Ahora mismo no hay profesionales cerca. Intenta de nuevo en unos minutos.'}</p>
            <Button block onClick={() => nav('/p', { replace: true })}>Volver al inicio</Button>
          </div>
        )}
      </div>
    </div>
  )
}
