import { Check, FileText, X } from 'lucide-react'
import { useState } from 'react'
import { MapView } from '../../components/MapView'
import { Avatar, Button, Card, StatusPill } from '../../components/ui'
import { docName, formatDate, money } from '../../lib/format'
import { useApp } from '../../store/AppContext'
import { isActive, serviceOf } from '../../store/sim'

export function Validations() {
  const { state, approve, openDoc } = useApp()
  const [leaving, setLeaving] = useState<string | null>(null)
  const pending = state.users.filter((u) => state.nurses[u.id]?.aprobado_por_admin === 'pendiente')
  const decided = state.users.filter((u) => ['aprobado', 'rechazado'].includes(state.nurses[u.id]?.aprobado_por_admin ?? ''))

  const decide = (id: string, ok: boolean) => {
    setLeaving(id)
    setTimeout(() => { approve(id, ok); setLeaving(null) }, 220)
  }

  return (
    <div className="scroll-y h-full px-5 pb-6">
      <h1 className="text-2xl font-extrabold">Validar profesionales</h1>
      <p className="mb-4 text-[14px] text-mute">{pending.length} pendiente(s) de aprobación</p>

      {pending.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm"><p className="text-3xl">🎉</p><p className="mt-2 font-bold">Todo al día</p><p className="text-[14px] text-mute">No hay perfiles por revisar.</p></div>
      ) : (
        <div className="stagger space-y-3">
          {pending.map((u, i) => {
            const d = state.nurses[u.id]
            return (
              <div key={u.id} style={{ ['--i' as string]: i }}>
                <Card className={`space-y-3 transition-[opacity,transform] duration-200 ${leaving === u.id ? 'scale-95 opacity-0' : ''}`}>
                  <div className="flex items-center gap-3"><Avatar name={u.nombre} color={u.color} size={48} /><div><p className="font-extrabold">{u.nombre}</p><p className="text-[13px] text-mute">{d.especialidad} · {d.experiencia} año(s)</p></div></div>
                  <div className="space-y-1.5">
                    {d.documentos_url.length === 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-700">Aún no subió documentos</p>}
                    {d.documentos_url.map((doc) => (
                      <button key={doc} onClick={() => openDoc(doc)} className="press flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left text-[13px] font-semibold"><FileText size={16} className="shrink-0 text-brand-600" /><span className="truncate underline underline-offset-2">{docName(doc)}</span></button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="danger" onClick={() => decide(u.id, false)}><X size={18} /> Rechazar</Button>
                    <Button variant="mint" disabled={d.documentos_url.length === 0} onClick={() => decide(u.id, true)}><Check size={18} /> Aprobar</Button>
                  </div>
                </Card>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="mb-2 mt-6 font-extrabold">Profesionales</h2>
      <div className="space-y-2">
        {decided.map((u) => (
          <Card key={u.id} className="flex items-center gap-3 !p-3">
            <Avatar name={u.nombre} color={u.color} size={40} online={state.nurses[u.id].online} />
            <span className="min-w-0 flex-1"><span className="block truncate font-bold">{u.nombre}</span><span className="text-[12px] text-mute">{state.nurses[u.id].servicios} servicios · {money(state.nurses[u.id].ganancias)}</span></span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${state.nurses[u.id].aprobado_por_admin === 'aprobado' ? 'bg-mint-50 text-mint-600' : 'bg-red-50 text-red-600'}`}>{state.nurses[u.id].aprobado_por_admin === 'aprobado' ? 'Aprobado' : 'Rechazado'}</span>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function Operations() {
  const { state } = useApp()
  const active = state.servicios.filter(isActive)
  const nurses = state.users.filter((u) => state.nurses[u.id]?.aprobado_por_admin === 'aprobado')
  const online = nurses.filter((u) => state.nurses[u.id].online).length

  return (
    <div className="scroll-y h-full px-5 pb-6">
      <h1 className="text-2xl font-extrabold">Operaciones</h1>
      <div className="mb-4 mt-3 grid grid-cols-3 gap-3">
        <Card className="!p-3 text-center"><p className="text-[12px] text-mute">Activas</p><p className="text-2xl font-extrabold text-brand-700">{active.length}</p></Card>
        <Card className="!p-3 text-center"><p className="text-[12px] text-mute">Conectados</p><p className="text-2xl font-extrabold text-mint-600">{online}</p></Card>
        <Card className="!p-3 text-center"><p className="text-[12px] text-mute">Total</p><p className="text-2xl font-extrabold">{state.servicios.length}</p></Card>
      </div>
      <MapView className="h-64 rounded-3xl" kmAcross={22} fit
        markers={[
          ...nurses.map((u) => ({ id: u.id, pos: state.servicios.find((s) => s.enfermero_id === u.id && isActive(s))?.nursePos ?? u.ubicacion, kind: 'nurse' as const, label: u.nombre, color: u.color, offline: !state.nurses[u.id].online })),
          ...active.map((s) => ({ id: s.id, pos: s.ubicacion_paciente, kind: 'request' as const })),
        ]} />
      <h2 className="mb-2 mt-5 font-extrabold">Solicitudes activas</h2>
      {active.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-[14px] text-mute">Sin solicitudes activas. Crea una desde la vista de paciente.</p>
      ) : (
        <div className="stagger space-y-2">
          {active.map((s, i) => (
            <Card key={s.id} className="flex items-center gap-3 !p-3">
              <span style={{ ['--i' as string]: i }} className="contents" />
              <span className="min-w-0 flex-1"><span className="block truncate font-bold">{serviceOf(s.servicio_id).nombre}</span><span className="block truncate text-[12px] text-mute">{state.users.find((u) => u.id === s.paciente_id)?.nombre} → {state.users.find((u) => u.id === s.enfermero_id)?.nombre ?? 'buscando…'} · {formatDate(s.creado)}</span></span>
              <StatusPill estado={s.estado} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
