import { ArrowLeft, Banknote, Calendar, CreditCard, Landmark, MapPin, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LocationSheet } from '../../components/LocationSheet'
import { MapView } from '../../components/MapView'
import { Avatar, Button, Card, Field, ServiceIcon, Stars, SuccessMark, inputCls } from '../../components/ui'
import { Segmented } from '../Login'
import { CATALOGO } from '../../data/seed'
import { etaMinutes, formatKm } from '../../lib/geo'
import { money } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { useApp, type Quote } from '../../store/AppContext'
import { availableNurses } from '../../store/sim'
import type { MetodoPago } from '../../types'

const PAGOS: { id: MetodoPago; label: string; sub: string; icon: typeof CreditCard }[] = [
  { id: 'tarjeta', label: 'Tarjeta de crédito', sub: 'Visa •••• 4242', icon: CreditCard },
  { id: 'efectivo', label: 'Efectivo', sub: 'Paga al terminar el servicio', icon: Banknote },
  { id: 'transferencia', label: 'Transferencia', sub: 'Nequi / PSE', icon: Landmark },
]

export default function Request() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { me, state, requestService, cotizar } = useApp()
  const [step, setStep] = useState(0)
  // ?s= viene de la URL: solo aceptar ids del catálogo para no romper la vista
  const fromUrl = params.get('s')
  const [sid, setSid] = useState(CATALOGO.some((c) => c.id === fromUrl) ? fromUrl! : 'inyect')
  const [inmediato, setInmediato] = useState(true)
  const [fecha, setFecha] = useState('')
  const [notas, setNotas] = useState('')
  const [pago, setPago] = useState<MetodoPago>('tarjeta')
  const [radio, setRadio] = useState<'5' | '10'>('5')
  const [loc, setLoc] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'paying' | 'ok'>('idle')

  const svc = CATALOGO.find((c) => c.id === sid)!
  const near = useMemo(
    () => (me ? availableNurses(state, me.ubicacion, [], Number(radio)) : []),
    [state, me, radio],
  )
  // El total lo calcula el servidor (cotizar), el mismo que cobra solicitar_servicio.
  const [q, setQ] = useState<Quote | null>(null)
  const lat = me?.ubicacion.lat
  const lng = me?.ubicacion.lng
  useEffect(() => {
    if (step !== 2 || lat === undefined || lng === undefined) return
    let alive = true
    setQ(null)
    cotizar(sid, inmediato, { lat, lng }).then((r) => alive && setQ(r))
    return () => {
      alive = false
    }
  }, [step, sid, inmediato, lat, lng, cotizar])
  // Sin ubicación guardada no se puede pedir: se abre el selector al entrar.
  const sinUbicacion = me !== null && me.direccion === ''
  useEffect(() => {
    if (sinUbicacion) setLoc(true)
  }, [sinUbicacion])
  if (!me) return null

  const canNext = step === 0 ? inmediato || (fecha !== '' && new Date(fecha).getTime() > Date.now()) : step === 1 ? near.length > 0 && !sinUbicacion : true
  const back = () => (step === 0 ? nav(-1) : setStep(step - 1))

  const confirm = async () => {
    setPhase('paying')
    const id = await requestService({
      servicio_id: sid, inmediato, fecha_hora: inmediato ? null : fecha, notas, metodo_pago: pago,
      direccion: me.direccion, ubicacion: me.ubicacion,
    })
    if (!id) {
      setPhase('idle') // el error ya salió como toast
      return
    }
    if (pago !== 'efectivo') {
      // Tarjeta y transferencia (Nequi/PSE) las cobra Wompi y vuelve a la pantalla de seguimiento; el servicio se despacha al confirmar el webhook.
      // Wompi rechaza redirect-url con http://localhost (403): en dev se regresa a la version publicada (https).
      // ponytail: en dev el seguimiento se ve en GitHub Pages (hay que iniciar sesion ahi); upgrade: URL https de tunel.
      const base = location.hostname === 'localhost' ? 'https://saimonproduce.github.io/enfermeraya/' : `${location.origin}${import.meta.env.BASE_URL}`
      const { data, error } = await supabase.functions.invoke<{ url: string }>('wompi-checkout', {
        body: { servicio_id: id, redirect_url: `${base}p/seguimiento/${id}` },
      })
      if (error || !data?.url) {
        nav(`/p/seguimiento/${id}`, { replace: true })
        return
      }
      location.href = data.url
      return
    }
    setPhase('ok')
    setTimeout(() => nav(`/p/seguimiento/${id}`, { replace: true }), 1100)
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 px-5 pb-3">
        <button onClick={back} aria-label="Atrás" className="press flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"><ArrowLeft size={20} /></button>
        <div className="flex flex-1 gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <span className="progress-fill block h-full w-full rounded-full bg-brand-600" style={{ transform: `scaleX(${i <= step ? 1 : 0})`, transitionDuration: '300ms', transitionTimingFunction: 'var(--ease-out)' }} />
            </span>
          ))}
        </div>
        <span className="w-10 text-right text-[13px] font-bold text-mute">{step + 1}/3</span>
      </div>

      <div className="scroll-y min-h-0 flex-1 px-5 pb-4">
        {step === 0 && (
          <div key="s0" className="step-enter space-y-5">
            <h1 className="text-2xl font-extrabold">¿Qué servicio necesitas?</h1>
            <div className="grid grid-cols-2 gap-2.5">
              {CATALOGO.map((c) => (
                <button key={c.id} onClick={() => setSid(c.id)} aria-pressed={sid === c.id}
                  className={`press rounded-2xl border-2 p-3 text-left transition-[border-color,background-color] duration-200 ${sid === c.id ? 'border-brand-600 bg-brand-50' : 'border-transparent bg-white shadow-sm'}`}>
                  <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200 ${sid === c.id ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}><ServiceIcon name={c.icon} size={18} /></span>
                  <span className="block text-[14px] font-bold leading-tight">{c.nombre}</span>
                  <span className="text-[12px] text-mute">{money(c.precio_base)} · {c.duracion}</span>
                </button>
              ))}
            </div>
            <p className="rounded-2xl bg-white p-3 text-[13px] text-mute shadow-sm">{svc.descripcion}</p>

            <div className="space-y-3">
              <h2 className="text-[17px] font-extrabold">¿Cuándo?</h2>
              <Segmented value={inmediato ? 'now' : 'later'} onChange={(v) => setInmediato(v === 'now')} options={[{ id: 'now', label: 'Ahora', icon: Zap }, { id: 'later', label: 'Programar', icon: Calendar }]} />
              {!inmediato && (
                <div className="step-enter"><input className={inputCls} type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
              )}
            </div>
            <Field label="Cuéntale al enfermero (opcional)">
              <textarea className={inputCls + ' h-24 resize-none py-3'} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: tengo fórmula médica, hay un perro en casa…" />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div key="s1" className="step-enter space-y-4">
            <h1 className="text-2xl font-extrabold">¿Dónde te atendemos?</h1>
            <button onClick={() => setLoc(true)} className="press w-full text-left">
              <Card className="flex items-center gap-3 !p-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-white"><MapPin size={20} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-bold">{me.direccion || 'Elige tu ubicación'}</span><span className="text-[13px] font-semibold text-brand-600">{me.direccion ? 'Cambiar' : 'Elegir'}</span></span>
              </Card>
            </button>
            <Segmented value={radio} onChange={setRadio} options={[{ id: '5', label: 'Radio 5 km' }, { id: '10', label: 'Radio 10 km' }]} />
            <MapView className="h-52 rounded-3xl" center={me.ubicacion} kmAcross={radio === '5' ? 11 : 22} radiusKm={Number(radio)}
              markers={[{ id: 'me', pos: me.ubicacion, kind: 'patient' }, ...near.map((c, i) => ({ id: c.user.id, pos: c.user.ubicacion, kind: 'nurse' as const, label: c.user.nombre, color: c.user.color, highlight: i === 0 }))]} />
            {near.length === 0 ? (
              <p className="rounded-2xl bg-amber-50 p-4 text-center text-[14px] font-semibold text-amber-700">No hay enfermeros conectados en {radio} km. Prueba ampliar el radio.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[14px] font-bold text-mint-600">{near.length} disponibles · llega en ~{etaMinutes(near[0].dist)} min</p>
                <div className="stagger space-y-2">
                  {near.slice(0, 4).map((c, i) => (
                    <Card key={c.user.id} className="flex items-center gap-3 !p-3" >
                      <span style={{ ['--i' as string]: i }} className="contents" />
                      <Avatar name={c.user.nombre} color={c.user.color} online />
                      <span className="min-w-0 flex-1"><span className="block truncate font-bold">{c.user.nombre}</span><span className="block truncate text-[12px] text-mute">{c.detail.especialidad}</span></span>
                      <span className="text-right"><Stars value={c.user.calificacion} /><span className="block text-[12px] text-mute">{formatKm(c.dist)}</span></span>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div key="s2" className="step-enter space-y-5">
            <h1 className="text-2xl font-extrabold">Pago y confirmación</h1>
            <div className="space-y-2.5">
              {PAGOS.map((p) => (
                <button key={p.id} onClick={() => setPago(p.id)} aria-pressed={pago === p.id}
                  className={`press flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-[border-color,background-color] duration-200 ${pago === p.id ? 'border-brand-600 bg-brand-50' : 'border-transparent bg-white shadow-sm'}`}>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${pago === p.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-mute'}`}><p.icon size={20} /></span>
                  <span className="flex-1"><span className="block font-bold">{p.label}</span><span className="text-[13px] text-mute">{p.sub}</span></span>
                  <span className={`h-5 w-5 rounded-full border-2 transition-all duration-200 ${pago === p.id ? 'border-brand-600 bg-brand-600 shadow-[inset_0_0_0_3px_white]' : 'border-slate-300'}`} />
                </button>
              ))}
            </div>
            <Card>
              <h3 className="mb-3 font-extrabold">Resumen</h3>
              {!q ? (
                <div className="shimmer h-24 rounded-2xl" aria-label="Calculando total" />
              ) : (
              <div className="space-y-2 text-[14px]">
                <Row l={svc.nombre} r={money(q.base)} />
                {q.recargo > 0 && <Row l="Recargo inmediato" r={money(q.recargo)} />}
                <Row l="Desplazamiento" r={money(q.desplazamiento)} />
                <div className="my-2 h-px bg-slate-100" />
                <div className="flex items-baseline justify-between"><span className="font-bold">Total estimado</span><span className="text-xl font-extrabold text-brand-700">{money(q.total)}</span></div>
              </div>
              )}
              <p className="mt-3 text-[12px] text-mute">{inmediato ? 'Servicio inmediato' : `Programado: ${new Date(fecha).toLocaleString('es-CO')}`} · {me.direccion}</p>
            </Card>
          </div>
        )}
      </div>

      <div className="safe-bottom shrink-0 border-t border-slate-100 bg-white px-5 pt-3">
        {step < 2 ? (
          <Button block disabled={!canNext} onClick={() => setStep(step + 1)}>Continuar</Button>
        ) : (
          <Button block disabled={!q} onClick={confirm}>Solicitar enfermero{q ? ` · ${money(q.total)}` : ''}</Button>
        )}
      </div>

      {phase !== 'idle' && (
        <div className="fade-enter absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/95 backdrop-blur-sm">
          {phase === 'paying' ? (
            <>
              <span className="spin h-14 w-14 rounded-full border-4 border-brand-100 border-t-brand-600" />
              <p className="font-bold">{pago === 'efectivo' ? 'Confirmando solicitud…' : 'Procesando pago…'}</p>
            </>
          ) : (
            <>
              <SuccessMark />
              <p className="text-lg font-extrabold">{pago === 'efectivo' ? '¡Solicitud enviada!' : '¡Pago aprobado!'}</p>
              <p className="text-mute">Buscando tu enfermero…</p>
            </>
          )}
        </div>
      )}
      <LocationSheet open={loc} onClose={() => setLoc(false)} />
    </div>
  )
}

const Row = ({ l, r }: { l: string; r: string }) => (
  <div className="flex justify-between"><span className="text-mute">{l}</span><span className="font-semibold">{r}</span></div>
)
