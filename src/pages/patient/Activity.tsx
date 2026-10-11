import { Receipt, Star } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '../../components/Sheet'
import { Avatar, Button, Card, ServiceIcon, StatusPill } from '../../components/ui'
import { formatDate, money } from '../../lib/format'
import { useApp } from '../../store/AppContext'
import { isActive, serviceOf } from '../../store/sim'
import type { Servicio } from '../../types'

export default function Activity() {
  const { me, state } = useApp()
  const nav = useNavigate()
  const [sel, setSel] = useState<Servicio | null>(null)
  if (!me) return null
  const mine = state.servicios.filter((s) => s.paciente_id === me.id)
  const spent = mine.filter((s) => s.estado === 'completado').reduce((a, s) => a + s.total, 0)
  const nurseOf = (s: Servicio) => state.users.find((u) => u.id === s.enfermero_id)

  return (
    <div className="scroll-y h-full px-5 pb-6">
      <h1 className="text-2xl font-extrabold">Tu actividad</h1>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card><p className="text-[13px] text-mute">Completados</p><p className="text-2xl font-extrabold">{mine.filter((s) => s.estado === 'completado').length}</p></Card>
        <Card><p className="text-[13px] text-mute">Total pagado</p><p className="text-2xl font-extrabold text-brand-700">{money(spent)}</p></Card>
      </div>

      {mine.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Receipt size={28} /></span>
          <p className="font-bold">Aún no tienes servicios</p>
          <p className="max-w-[240px] text-[14px] text-mute">Cuando solicites uno, aparecerá aquí con su factura.</p>
          <Button onClick={() => nav('/p/solicitar')}>Solicitar ahora</Button>
        </div>
      ) : (
        <ul className="stagger mt-5 space-y-3">
          {mine.map((s, i) => {
            const svc = serviceOf(s.servicio_id)
            const n = nurseOf(s)
            return (
              <li key={s.id} style={{ ['--i' as string]: Math.min(i, 8) }}>
                <button onClick={() => (isActive(s) ? nav(`/p/seguimiento/${s.id}`) : setSel(s))} className="press w-full text-left">
                  <Card className="flex items-center gap-3 !p-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><ServiceIcon name={svc.icon} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{svc.nombre}</span>
                      <span className="block truncate text-[12px] text-mute">{formatDate(s.creado)}{n ? ` · ${n.nombre}` : ''}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1"><span className="font-extrabold">{money(s.total)}</span><StatusPill estado={s.estado} /></span>
                  </Card>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={!!sel} onClose={() => setSel(null)} title="Factura">
        {sel && (() => {
          const svc = serviceOf(sel.servicio_id)
          const n = nurseOf(sel)
          return (
            <div className="space-y-4 pb-2">
              <div className="flex items-center justify-between"><h2 className="text-xl font-extrabold">Factura</h2><StatusPill estado={sel.estado} /></div>
              <Card className="!bg-slate-50 !shadow-none">
                <p className="text-[12px] text-mute">N.º {sel.id.toUpperCase()} · {formatDate(sel.creado)}</p>
                <p className="mt-1 font-bold">{svc.nombre}</p>
                <p className="text-[13px] text-mute">{sel.direccion}</p>
                <div className="my-3 h-px bg-slate-200" />
                <div className="flex justify-between text-[14px]"><span className="text-mute">Método de pago</span><span className="font-semibold capitalize">{sel.metodo_pago}</span></div>
                <div className="mt-2 flex items-baseline justify-between"><span className="font-bold">Total</span><span className="text-xl font-extrabold text-brand-700">{money(sel.total)}</span></div>
              </Card>
              {n && (
                <div className="flex items-center gap-3"><Avatar name={n.nombre} color={n.color} /><div className="flex-1"><p className="font-bold">{n.nombre}</p><p className="text-[13px] text-mute">Profesional</p></div>
                  {sel.calificacion !== null && <span className="flex items-center gap-1 font-bold text-amber-500"><Star size={16} fill="currentColor" strokeWidth={0} />{sel.calificacion}</span>}
                </div>
              )}
              {sel.estado === 'completado' && sel.calificacion === null && (
                <Button block variant="soft" onClick={() => nav(`/p/seguimiento/${sel.id}`)}>Calificar servicio</Button>
              )}
              {sel.resena && <p className="rounded-2xl bg-slate-50 p-3 text-[14px] italic text-mute">“{sel.resena}”</p>}
              <Button block variant="ghost" onClick={() => nav(`/p/solicitar?s=${sel.servicio_id}`)}>Repetir servicio</Button>
            </div>
          )
        })()}
      </Sheet>
    </div>
  )
}
