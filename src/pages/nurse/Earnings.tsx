import { Star, TrendingUp } from 'lucide-react'
import { Card, ServiceIcon } from '../../components/ui'
import { formatDate, isSameDay, money } from '../../lib/format'
import { useApp } from '../../store/AppContext'
import { serviceOf } from '../../store/sim'

const DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

export default function Earnings() {
  const { me, myNurse, state } = useApp()
  if (!me || !myNurse) return null
  const done = state.servicios.filter((s) => s.enfermero_id === me.id && s.estado === 'completado')
  const rated = done.filter((s) => s.calificacion !== null)

  // Solo datos reales: suma de servicios completados por día calendario (últimos 7 días)
  const net = (s: { total: number }) => s.total * 0.85
  const today = done.filter((s) => isSameDay(s.estado_ts)).reduce((a, s) => a + net(s), 0)
  const bars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5)
    const v = done.filter((s) => isSameDay(s.estado_ts, d.getTime())).reduce((a, s) => a + net(s), 0)
    return { label: DAYS[d.getDay()], v }
  })
  const max = Math.max(...bars.map((b) => b.v), 1)

  return (
    <div className="scroll-y h-full px-5 pb-6">
      <div className="stagger space-y-4">
        <Card className="!bg-gradient-to-br !from-brand-600 !to-mint-500 !text-white" >
          <p className="text-[13px] font-semibold text-white/80">Ganancias totales</p>
          <p className="text-[34px] font-extrabold leading-tight tabular-nums">{money(myNurse.ganancias)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-white/85"><TrendingUp size={15} /> Recibes el 85% de cada servicio</p>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Card><p className="text-[13px] text-mute">Servicios</p><p className="text-2xl font-extrabold">{myNurse.servicios}</p></Card>
          <Card><p className="text-[13px] text-mute">Calificación</p><p className="flex items-center gap-1 text-2xl font-extrabold"><Star size={22} fill="#f59e0b" strokeWidth={0} />{me.calificacion.toFixed(1)}</p></Card>
        </div>
        <Card>
          <h2 className="mb-4 font-extrabold">Últimos 7 días</h2>
          <div className="flex h-32 items-end gap-2">
            {bars.map((b, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-full w-full items-end">
                  <div className={`w-full origin-bottom rounded-lg ${i === 6 ? 'bg-brand-600' : 'bg-brand-200'}`} style={{ height: `${Math.max(6, (b.v / max) * 100)}%`, animation: `enter-up 400ms var(--ease-out) ${i * 40}ms both` }} />
                </div>
                <span className="text-[11px] font-semibold text-mute">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <section>
          <h2 className="mb-2 font-extrabold">Servicios completados</h2>
          {done.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-[14px] text-mute">Aún no has completado servicios en esta sesión.</p>
          ) : (
            <div className="space-y-2">
              {done.map((s) => (
                <Card key={s.id} className="flex items-center gap-3 !p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><ServiceIcon name={serviceOf(s.servicio_id).icon} size={18} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-bold">{serviceOf(s.servicio_id).nombre}</span><span className="text-[12px] text-mute">{formatDate(s.estado_ts)}{s.calificacion ? ` · ${'★'.repeat(s.calificacion)}` : ''}</span></span>
                  <span className="font-extrabold text-mint-600">+{money(s.total * 0.85)}</span>
                </Card>
              ))}
            </div>
          )}
          {rated.length > 0 && <p className="mt-3 text-center text-[13px] text-mute">{rated.length} reseña(s) recibidas</p>}
        </section>
      </div>
    </div>
  )
}
