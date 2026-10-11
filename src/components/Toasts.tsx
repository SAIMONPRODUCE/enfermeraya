import { BellRing, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import type { Notificacion } from '../types'

function Toast({ n, onDone }: { n: Notificacion; onDone: () => void }) {
  const [inn, setIn] = useState(false)
  // onDone cambia de identidad en cada render del padre; los timers no deben reiniciarse por eso
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    const a = requestAnimationFrame(() => setIn(true))
    const t1 = setTimeout(() => setIn(false), 4200)
    const t2 = setTimeout(() => done.current(), 4500)
    return () => {
      cancelAnimationFrame(a)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])
  const Icon = n.tipo === 'exito' ? CheckCircle2 : n.tipo === 'alerta' ? TriangleAlert : Info
  const tone = n.tipo === 'exito' ? 'bg-mint-50 text-mint-600' : n.tipo === 'alerta' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'
  return (
    <button
      onClick={onDone}
      data-in={inn}
      className="toast press pointer-events-auto flex w-full items-start gap-3 rounded-2xl bg-white p-3 text-left shadow-[0_12px_32px_-8px_rgba(15,31,61,0.3)]"
    >
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={20} /></span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold leading-tight">{n.titulo}</span>
        <span className="block text-[13px] leading-snug text-mute">{n.cuerpo}</span>
      </span>
    </button>
  )
}

export function Toasts() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex flex-col gap-2 px-3 pt-[max(env(safe-area-inset-top,0px),12px)]">
      {toasts.map((t) => (
        <Toast key={t.id} n={t} onDone={() => dismissToast(t.id)} />
      ))}
    </div>
  )
}

export { BellRing }
