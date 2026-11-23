import { Banknote, Check, Clock, Landmark, Pencil, Smartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Segmented } from '../pages/Login'
import { LIMITE_DEUDA, RETIRO_CADA_DIAS, RETIRO_MINIMO, enmascarar, formatDate, money, proximoRetiro } from '../lib/format'
import { useApp } from '../store/AppContext'
import type { CuentaCobro, MetodoCobro, Retiro } from '../types'
import { Sheet } from './Sheet'
import { Button, Card, Field, inputCls } from './ui'

export const METODO_LABEL: Record<MetodoCobro, string> = { nequi: 'Nequi', daviplata: 'Daviplata', banco: 'Cuenta bancaria' }

/** "Nequi •••• 4567" / "Bancolombia ahorros •••• 8901" */
export const cuentaResumen = (c: CuentaCobro) =>
  c.metodo === 'banco' ? `${c.banco} ${c.tipo_cuenta} ${enmascarar(c.numero)}` : `${METODO_LABEL[c.metodo]} ${enmascarar(c.numero)}`

const EMPTY: CuentaCobro = { metodo: 'nequi', banco: '', tipo_cuenta: 'ahorros', numero: '', titular: '' }

/** Hoja para guardar o cambiar la cuenta donde se reciben los retiros. */
function CuentaSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { state, saveCuenta } = useApp()
  const [c, setC] = useState<CuentaCobro>(state.cuenta ?? EMPTY)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setC(state.cuenta ?? EMPTY)
  }, [open, state.cuenta])
  const digits = c.numero.replace(/\D/g, '')
  const valid = digits.length >= 7 && digits.length <= 20 && c.titular.trim().length >= 3 && (c.metodo !== 'banco' || c.banco.trim() !== '')
  const save = async () => {
    setBusy(true)
    const ok = await saveCuenta({ ...c, numero: digits, titular: c.titular.trim(), banco: c.metodo === 'banco' ? c.banco.trim() : '' })
    setBusy(false)
    if (ok) onSaved()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Cuenta de cobro">
      <h2 className="text-[22px] font-extrabold tracking-tight">¿Dónde recibes tu dinero?</h2>
      <p className="mb-4 mt-1 text-[14px] text-mute">Pagamos tus retiros a esta cuenta. Debe estar a tu nombre.</p>
      <Segmented<MetodoCobro>
        value={c.metodo}
        onChange={(metodo) => setC({ ...c, metodo })}
        options={[{ id: 'nequi', label: 'Nequi' }, { id: 'daviplata', label: 'Daviplata' }, { id: 'banco', label: 'Banco' }]}
      />
      <div className="mt-4 space-y-3">
        {c.metodo === 'banco' && (
          <>
            <Field label="Banco">
              <input className={inputCls} value={c.banco} maxLength={40} onChange={(e) => setC({ ...c, banco: e.target.value })} placeholder="Bancolombia, Davivienda, Nu…" />
            </Field>
            <Segmented<'ahorros' | 'corriente'>
              value={c.tipo_cuenta === 'corriente' ? 'corriente' : 'ahorros'}
              onChange={(tipo_cuenta) => setC({ ...c, tipo_cuenta })}
              options={[{ id: 'ahorros', label: 'Ahorros' }, { id: 'corriente', label: 'Corriente' }]}
            />
          </>
        )}
        <Field label={c.metodo === 'banco' ? 'Número de cuenta' : `Número de ${METODO_LABEL[c.metodo]}`}>
          <input className={inputCls} inputMode="numeric" value={c.numero} maxLength={24} onChange={(e) => setC({ ...c, numero: e.target.value })} placeholder={c.metodo === 'banco' ? '12345678901' : '300 123 4567'} />
        </Field>
        <Field label="Nombre del titular">
          <input className={inputCls} autoComplete="name" value={c.titular} maxLength={80} onChange={(e) => setC({ ...c, titular: e.target.value })} placeholder="Como aparece en la cuenta" />
        </Field>
      </div>
      <Button block className="mt-5" loading={busy} disabled={!valid} onClick={save}>Guardar cuenta</Button>
    </Sheet>
  )
}

/** Hoja para pedir un retiro del saldo. */
function RetiroSheet({ open, onClose, saldo, onEditCuenta }: { open: boolean; onClose: () => void; saldo: number; onEditCuenta: () => void }) {
  const { state, requestWithdrawal } = useApp()
  const [txt, setTxt] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setTxt(String(saldo))
  }, [open, saldo])
  const monto = Number(txt.replace(/\D/g, ''))
  const err = monto < RETIRO_MINIMO ? `El mínimo es ${money(RETIRO_MINIMO)}.` : monto > saldo ? 'Es más que tu saldo disponible.' : ''
  const send = async () => {
    setBusy(true)
    const ok = await requestWithdrawal(monto)
    setBusy(false)
    if (ok) onClose()
  }
  const cuenta = state.cuenta
  return (
    <Sheet open={open} onClose={onClose} title="Retirar">
      <h2 className="text-[22px] font-extrabold tracking-tight">Retirar ganancias</h2>
      <p className="mt-1 text-[14px] text-mute">Disponible: <b className="text-ink">{money(saldo)}</b></p>
      <div className="mt-4">
        <Field label="¿Cuánto quieres retirar?">
          <input className={inputCls + ' text-[22px] font-extrabold tabular-nums'} inputMode="numeric" value={txt ? money(monto) : ''} onChange={(e) => setTxt(e.target.value.replace(/\D/g, ''))} aria-invalid={!!err} />
        </Field>
        {err ? <p role="alert" className="mt-1.5 text-[13px] font-semibold text-red-700">{err}</p> : <button onClick={() => setTxt(String(saldo))} className="press mt-1.5 text-[13px] font-semibold text-brand-700 underline underline-offset-4">Retirar todo</button>}
      </div>
      {cuenta && (
        <Card className="mt-4 flex items-center gap-3 !bg-slate-50 !p-3 !shadow-none">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{cuenta.metodo === 'banco' ? <Landmark size={20} /> : <Smartphone size={20} />}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold capitalize">{cuentaResumen(cuenta)}</span>
            <span className="block truncate text-[13px] text-mute">{cuenta.titular}</span>
          </span>
          <button onClick={onEditCuenta} aria-label="Cambiar cuenta" className="press flex h-10 w-10 items-center justify-center rounded-full bg-white text-mute"><Pencil size={16} /></button>
        </Card>
      )}
      <p className="mt-3 text-[13px] text-mute">Un administrador revisa y paga tu retiro. Te avisamos aquí cuando esté listo.</p>
      <Button block variant="mint" className="mt-4" loading={busy} disabled={!!err || monto === 0} onClick={send}><Banknote size={18} /> Pedir retiro de {money(monto)}</Button>
    </Sheet>
  )
}

const ESTADO_RETIRO = {
  pendiente: { label: 'Por pagar', cls: 'bg-amber-50 text-amber-700', icon: Clock },
  pagado: { label: 'Pagado', cls: 'bg-mint-50 text-mint-700', icon: Check },
  rechazado: { label: 'Rechazado', cls: 'bg-red-50 text-red-700', icon: X },
} as const

export const RetiroPill = ({ estado }: { estado: Retiro['estado'] }) => {
  const e = ESTADO_RETIRO[estado]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${e.cls}`}><e.icon size={12} strokeWidth={3} />{e.label}</span>
}

/** Bloque de retiros del profesional: saldo, botón, retiro pendiente e historial. */
export function RetirosProfesional({ saldo }: { saldo: number }) {
  const { state } = useApp()
  const [retiro, setRetiro] = useState(false)
  const [cuenta, setCuenta] = useState(false)
  // Si la cuenta se abrió desde el flujo de retiro, al guardarla se vuelve a él.
  const [volver, setVolver] = useState(false)
  const pendiente = state.retiros.find((r) => r.estado === 'pendiente')
  const espera = proximoRetiro(state.retiros)
  const puede = !pendiente && !espera && saldo >= RETIRO_MINIMO
  const abrir = () => {
    if (state.cuenta) return setRetiro(true)
    setVolver(true)
    setCuenta(true)
  }
  const hint = saldo < 0
    ? `Debes ${money(-saldo)} de comisión (15 %) por servicios en efectivo. Se descuenta de tus próximas ganancias por tarjeta o transferencia, o págala al administrador. Con más de ${money(LIMITE_DEUDA)} no puedes conectarte.`
    : pendiente
    ? 'Tienes un retiro por pagar. Cuando se pague podrás pedir otro.'
    : espera
      ? `Retiras una vez cada ${RETIRO_CADA_DIAS} días. Podrás volver a pedir el ${formatDate(espera).replace(/\.$/, "")}.`
      : saldo < RETIRO_MINIMO
        ? `Retiro mínimo ${money(RETIRO_MINIMO)}. Te faltan ${money(RETIRO_MINIMO - Math.max(saldo, 0))}.`
        : `Un administrador paga tu retiro a tu cuenta. Puedes retirar una vez cada ${RETIRO_CADA_DIAS} días.`
  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] text-mute">{saldo < 0 ? 'Comisión por pagar' : 'Saldo disponible'}</p>
            <p className={`text-[28px] font-extrabold leading-tight tracking-tight tabular-nums ${saldo < 0 ? 'text-red-700' : ''}`}>{money(Math.abs(saldo))}</p>
          </div>
          <Button variant="mint" disabled={!puede} onClick={abrir}><Banknote size={18} /> Retirar</Button>
        </div>
        <p className="mt-2 text-[13px] text-mute">{hint}</p>
        {state.cuenta && (
          <button onClick={() => { setVolver(false); setCuenta(true) }} className="press mt-3 flex w-full items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-left text-[13px]">
            {state.cuenta.metodo === 'banco' ? <Landmark size={16} className="shrink-0 text-mute" /> : <Smartphone size={16} className="shrink-0 text-mute" />}
            <span className="min-w-0 flex-1 truncate font-semibold capitalize">{cuentaResumen(state.cuenta)}</span>
            <span className="font-semibold text-brand-700">Cambiar</span>
          </button>
        )}
      </Card>

      {state.retiros.length > 0 && (
        <section>
          <h2 className="mb-2 text-[18px] font-extrabold tracking-tight">Tus retiros</h2>
          <div className="space-y-2">
            {state.retiros.slice(0, 8).map((r) => (
              <Card key={r.id} className="!p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-extrabold tabular-nums">{money(r.monto)}</span>
                  <RetiroPill estado={r.estado} />
                </div>
                <p className="mt-1 text-[13px] text-mute">{formatDate(r.creado)}</p>
                <p className="text-[13px] capitalize text-mute">{cuentaResumen(r)}</p>
                {r.estado === 'pagado' && r.referencia && <p className="mt-1 text-[13px]">Referencia: <b>{r.referencia}</b></p>}
                {r.estado === 'rechazado' && r.nota && <p className="mt-1 text-[13px] text-red-700">Motivo: {r.nota}</p>}
              </Card>
            ))}
          </div>
        </section>
      )}

      <RetiroSheet open={retiro} onClose={() => setRetiro(false)} saldo={saldo} onEditCuenta={() => { setRetiro(false); setVolver(true); setCuenta(true) }} />
      <CuentaSheet open={cuenta} onClose={() => setCuenta(false)} onSaved={() => { setCuenta(false); if (volver && puede) setRetiro(true) }} />
    </>
  )
}
