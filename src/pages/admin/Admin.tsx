import { Banknote, Check, Copy, FileText, X } from 'lucide-react'
import { useState } from 'react'
import { MapView } from '../../components/MapView'
import { Sheet } from '../../components/Sheet'
import { METODO_LABEL, RetiroPill } from '../../components/Withdraw'
import { Avatar, Button, Card, Field, StatusPill, inputCls } from '../../components/ui'
import { LIMITE_DEUDA, docName, formatDate, money } from '../../lib/format'
import { useApp } from '../../store/AppContext'
import { isActive, serviceOf } from '../../store/sim'
import type { Retiro } from '../../types'

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
    <div className="scroll-y h-full px-5 pb-8">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">Validar profesionales</h1>
      <p className="mb-4 text-[14px] text-mute">{pending.length} {pending.length === 1 ? 'pendiente' : 'pendientes'} de aprobación</p>

      {pending.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm"><p className="mt-2 font-bold">Todo al día</p><p className="text-[14px] text-mute">No hay perfiles por revisar.</p></div>
      ) : (
        <div className="stagger space-y-3">
          {pending.map((u, i) => {
            const d = state.nurses[u.id]
            return (
              <div key={u.id} style={{ ['--i' as string]: i }}>
                <Card className={`space-y-3 transition-[opacity,transform] duration-200 ${leaving === u.id ? 'scale-95 opacity-0' : ''}`}>
                  <div className="flex items-center gap-3"><Avatar name={u.nombre} color={u.color} size={48} /><div><p className="font-extrabold">{u.nombre}</p><p className="text-[13px] text-mute">{d.especialidad} · {d.experiencia} {d.experiencia === 1 ? 'año' : 'años'}</p></div></div>
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
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${state.nurses[u.id].aprobado_por_admin === 'aprobado' ? 'bg-mint-50 text-mint-700' : 'bg-red-50 text-red-600'}`}>{state.nurses[u.id].aprobado_por_admin === 'aprobado' ? 'Aprobado' : 'Rechazado'}</span>
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
    <div className="scroll-y h-full px-5 pb-8">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">Operaciones</h1>
      <div className="mb-4 mt-3 grid grid-cols-3 gap-3">
        <Card className="!p-3 text-center"><p className="text-[12px] text-mute">Activas</p><p className="text-[26px] font-extrabold leading-tight tracking-tight text-brand-700">{active.length}</p></Card>
        <Card className="!p-3 text-center"><p className="text-[12px] text-mute">Conectados</p><p className="text-[26px] font-extrabold leading-tight tracking-tight text-mint-700">{online}</p></Card>
        <Card className="!p-3 text-center"><p className="text-[12px] text-mute">Total</p><p className="text-[26px] font-extrabold leading-tight tracking-tight">{state.servicios.length}</p></Card>
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

/** Retiros de los profesionales: el admin paga por fuera de la app y aquí lo marca pagado (con referencia) o rechazado (con motivo). */
export function Withdrawals() {
  const { state, resolveWithdrawal, registerAbono } = useApp()
  const [sel, setSel] = useState<{ r: Retiro; pagado: boolean } | null>(null)
  // Pago de comisión de efectivo que el profesional hizo por fuera
  const [abono, setAbono] = useState<{ id: string; debe: number } | null>(null)
  const [abonoMonto, setAbonoMonto] = useState('')
  const [abonoRef, setAbonoRef] = useState('')
  const abonoValor = Number(abonoMonto.replace(/\D/g, ''))
  const abrirAbono = (id: string, debe: number) => {
    setAbonoMonto(String(debe))
    setAbonoRef('')
    setAbono({ id, debe })
  }
  const enviarAbono = async () => {
    if (!abono) return
    setBusy(true)
    const ok = await registerAbono(abono.id, abonoValor, abonoRef.trim())
    setBusy(false)
    if (ok) setAbono(null)
  }
  const [txt, setTxt] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')
  const pendientes = state.retiros.filter((r) => r.estado === 'pendiente')
  const resueltos = state.retiros.filter((r) => r.estado !== 'pendiente')
  const nameOf = (id: string) => state.users.find((u) => u.id === id)?.nombre ?? 'Profesional'

  const copy = async (numero: string) => {
    try {
      await navigator.clipboard.writeText(numero)
      setCopied(numero)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      /* sin permiso de portapapeles: el número queda visible para copiarlo a mano */
    }
  }
  const open = (r: Retiro, pagado: boolean) => {
    setTxt('')
    setSel({ r, pagado })
  }
  const send = async () => {
    if (!sel) return
    setBusy(true)
    const ok = await resolveWithdrawal(sel.r.id, sel.pagado, sel.pagado ? txt : '', sel.pagado ? '' : txt)
    setBusy(false)
    if (ok) setSel(null)
  }

  return (
    <div className="scroll-y h-full px-5 pb-8">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">Retiros</h1>
      <p className="mb-4 text-[14px] text-mute">
        {pendientes.length === 0 ? 'No hay retiros por pagar.' : <><b>{pendientes.length}</b> {pendientes.length === 1 ? 'retiro por pagar' : 'retiros por pagar'} por <b>{money(pendientes.reduce((a, r) => a + r.monto, 0))}</b></>}
      </p>

      {state.deudas.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 font-extrabold">Comisiones por cobrar</h2>
          <p className="mb-2 text-[13px] text-mute">15 % de servicios en efectivo. Registra aquí lo que el profesional te pague por fuera.</p>
          <div className="space-y-2">
            {state.deudas.map((d) => (
              <Card key={d.usuario_id} className="flex items-center gap-3 !p-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{nameOf(d.usuario_id)}</span>
                  <span className="text-[13px] text-mute">{d.debe > LIMITE_DEUDA ? 'Bloqueado hasta pagar' : 'Se descuenta de sus ganancias'}</span>
                </span>
                <span className="font-extrabold tabular-nums text-red-700">{money(d.debe)}</span>
                <Button variant="mint" onClick={() => abrirAbono(d.usuario_id, d.debe)}>Registrar pago</Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-3">
        {pendientes.map((r) => (
          <Card key={r.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-extrabold">{nameOf(r.usuario_id)}</p>
                <p className="text-[13px] text-mute">{formatDate(r.creado)}</p>
              </div>
              <p className="text-[22px] font-extrabold leading-tight tabular-nums text-brand-700">{money(r.monto)}</p>
            </div>
            <dl className="space-y-1.5 rounded-2xl bg-slate-50 p-3 text-[14px]">
              <div className="flex justify-between gap-3"><dt className="text-mute">Medio</dt><dd className="font-semibold capitalize">{r.metodo === 'banco' ? `${r.banco} · ${r.tipo_cuenta}` : METODO_LABEL[r.metodo]}</dd></div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-mute">Número</dt>
                <dd className="flex items-center gap-2 font-semibold tabular-nums">
                  {r.numero}
                  <button onClick={() => copy(r.numero)} aria-label="Copiar número" className="press flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-700">
                    {copied === r.numero ? <Check size={16} strokeWidth={3} /> : <Copy size={16} />}
                  </button>
                </dd>
              </div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Titular</dt><dd className="text-right font-semibold">{r.titular}</dd></div>
            </dl>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="danger" onClick={() => open(r, false)}><X size={18} /> Rechazar</Button>
              <Button variant="mint" onClick={() => open(r, true)}><Banknote size={18} /> Ya pagué</Button>
            </div>
          </Card>
        ))}
      </div>

      {resueltos.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-extrabold">Historial</h2>
          <div className="space-y-2">
            {resueltos.slice(0, 20).map((r) => (
              <Card key={r.id} className="!p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-bold">{nameOf(r.usuario_id)}</span>
                  <span className="font-extrabold tabular-nums">{money(r.monto)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-[13px] text-mute">
                  <span className="min-w-0 truncate">{formatDate(r.resuelto_ts || r.creado)}</span>
                  <RetiroPill estado={r.estado} />
                </div>
                {r.estado === 'pagado' && r.referencia && <p className="mt-1 text-[13px]">Referencia: <b>{r.referencia}</b></p>}
                {r.estado === 'rechazado' && r.nota && <p className="mt-1 text-[13px] text-red-700">Motivo: {r.nota}</p>}
              </Card>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!abono} onClose={() => setAbono(null)} title="Registrar pago de comisión">
        {abono && (
          <div className="space-y-3 pb-2">
            <h2 className="text-[22px] font-extrabold tracking-tight">Pago de {nameOf(abono.id)}</h2>
            <p className="text-[14px] text-mute">Debe {money(abono.debe)}.</p>
            <Field label="Monto recibido">
              <input className={inputCls + ' tabular-nums'} inputMode="numeric" value={abonoMonto ? money(abonoValor) : ''} onChange={(e) => setAbonoMonto(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Referencia del pago">
              <input className={inputCls} value={abonoRef} maxLength={80} onChange={(e) => setAbonoRef(e.target.value)} placeholder="Ej: Nequi 123456" />
            </Field>
            <Button block variant="mint" loading={busy} disabled={abonoValor <= 0 || abonoValor > abono.debe || abonoRef.trim().length < 3} onClick={enviarAbono}>Registrar {money(abonoValor)}</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.pagado ? 'Marcar pagado' : 'Rechazar retiro'}>
        {sel && (
          <div className="pb-2">
            <h2 className="text-[22px] font-extrabold tracking-tight">{sel.pagado ? 'Confirmar pago' : 'Rechazar retiro'}</h2>
            <p className="mb-4 mt-1 text-[14px] text-mute">
              {money(sel.r.monto)} para <b className="text-ink">{nameOf(sel.r.usuario_id)}</b>.{' '}
              {sel.pagado ? 'Confirma solo cuando ya hiciste la transferencia.' : 'El saldo vuelve a estar disponible para el profesional.'}
            </p>
            <Field label={sel.pagado ? 'Referencia del pago' : 'Motivo del rechazo'}>
              <input className={inputCls} value={txt} maxLength={sel.pagado ? 80 : 300} onChange={(e) => setTxt(e.target.value)} placeholder={sel.pagado ? 'Número de comprobante' : 'Ej.: el titular no coincide'} />
            </Field>
            <Button block variant={sel.pagado ? 'mint' : 'danger'} className="mt-4" loading={busy} disabled={txt.trim() === ''} onClick={send}>
              {sel.pagado ? 'Confirmar que ya pagué' : 'Rechazar retiro'}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
