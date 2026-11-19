import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { OFERTA } from '../data/seed'
import { money } from '../lib/format'
import { useApp } from '../store/AppContext'
import { tarifaDe } from '../store/sim'
import type { ServiceCatalog } from '../types'
import { Sheet } from './Sheet'
import { Button, Card, Field, ServiceTile, inputCls } from './ui'

/** Hoja para fijar la tarifa propia de un servicio dentro del rango público. */
function TarifaSheet({ open, svc, onClose }: { open: boolean; svc: ServiceCatalog; onClose: () => void }) {
  const { state, me, setTarifa } = useApp()
  const [txt, setTxt] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open && me) setTxt(String(tarifaDe(state, me.id, svc.id)))
  }, [open, svc, me, state])
  const precio = Number(txt.replace(/\D/g, ''))
  const err = precio < svc.precio_min || precio > svc.precio_max ? `Debe estar entre ${money(svc.precio_min)} y ${money(svc.precio_max)}.` : ''
  const save = async () => {
    setBusy(true)
    const ok = await setTarifa(svc.id, precio)
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Tarifa">
      <h2 className="text-[22px] font-extrabold tracking-tight">{svc.nombre}</h2>
      <p className="mt-1 text-[14px] text-mute">Rango {money(svc.precio_min)} a {money(svc.precio_max)} · sugerido {money(svc.precio_base)}</p>
      <div className="mt-4">
        <Field label="Tu tarifa por servicio">
          <input className={inputCls + ' text-[22px] font-extrabold tabular-nums'} inputMode="numeric" value={txt ? money(precio) : ''} onChange={(e) => setTxt(e.target.value.replace(/\D/g, ''))} aria-invalid={!!err} />
        </Field>
        {err ? <p role="alert" className="mt-1.5 text-[13px] font-semibold text-red-700">{err}</p> : <button onClick={() => setTxt(String(svc.precio_base))} className="press mt-1.5 text-[13px] font-semibold text-brand-700 underline underline-offset-4">Usar el sugerido</button>}
      </div>
      <p className="mt-3 text-[13px] text-mute">El paciente ve tu tarifa antes de pedir. A ella se suman el desplazamiento y, si es inmediato, el recargo. Recibes el 85 % del total.</p>
      <Button block className="mt-4" loading={busy} disabled={!!err} onClick={save}>Guardar tarifa</Button>
    </Sheet>
  )
}

/** Tarifas del profesional: una por servicio. */
export function TarifasProfesional() {
  const { state, me } = useApp()
  // svc se conserva al cerrar para que la hoja no se vacíe durante la animación de salida
  const [svc, setSvc] = useState<ServiceCatalog>(OFERTA[0])
  const [open, setOpen] = useState(false)
  if (!me) return null
  // La hoja va fuera de <section>: la animación .stagger aplica transform al hijo y lo volvería su contenedor.
  return (
    <>
      <section>
        <h2 className="mb-1 text-[18px] font-extrabold tracking-tight">Tus tarifas</h2>
        <p className="mb-2 text-[13px] text-mute">Tú decides cuánto cobras. Si no la cambias, usas la sugerida.</p>
        <Card className="divide-y divide-slate-100 !p-0">
          {OFERTA.map((c) => {
            const propia = state.tarifas[me.id]?.[c.id] !== undefined
            return (
              <button key={c.id} onClick={() => { setSvc(c); setOpen(true) }} className="press flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <ServiceTile id={c.id} icon={c.icon} size={36} />
                <span className="min-w-0 flex-1"><span className="block truncate font-bold">{c.nombre}</span><span className="text-[12px] text-mute">{propia ? 'Tarifa propia' : 'Sugerida'}</span></span>
                <span className="font-extrabold tabular-nums">{money(tarifaDe(state, me.id, c.id))}</span>
                <ChevronRight size={16} className="shrink-0 text-mute" />
              </button>
            )
          })}
        </Card>
      </section>
      <TarifaSheet open={open} svc={svc} onClose={() => setOpen(false)} />
    </>
  )
}
