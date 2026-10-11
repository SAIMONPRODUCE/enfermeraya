import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  dismissible?: boolean
}

/** Ventana de muestreo para la velocidad del arrastre: un flick tras un arrastre lento debe contar. */
const SAMPLE_MS = 50

/** Bottom sheet con drag-to-dismiss (umbral de distancia o velocidad > 0.11 px/ms). */
export function Sheet({ open, onClose, children, title, dismissible = true }: Props) {
  const [mounted, setMounted] = useState(open)
  const [vis, setVis] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; id: number; ly: number; lt: number } | null>(null)
  // onClose cambia de identidad en cada render del padre; el listener no debe re-registrarse por eso
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (open) {
      setMounted(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
      return () => cancelAnimationFrame(r)
    }
    setVis(false)
    const t = setTimeout(() => setMounted(false), 240)
    return () => clearTimeout(t)
  }, [open])

  // Foco al panel al abrir y devuelto al elemento anterior al cerrar; Escape cierra si es descartable
  useEffect(() => {
    if (!open || !mounted) return
    const prev = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, mounted, dismissible])

  if (!mounted) return null

  const down = (e: React.PointerEvent) => {
    if (!dismissible || drag.current) return
    const now = Date.now()
    drag.current = { y: e.clientY, id: e.pointerId, ly: e.clientY, lt: now }
    e.currentTarget.setPointerCapture(e.pointerId)
    panel.current?.setAttribute('data-drag', 'true')
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId || !panel.current) return
    const now = Date.now()
    if (now - d.lt >= SAMPLE_MS) {
      d.ly = e.clientY
      d.lt = now
    }
    const dy = e.clientY - d.y
    // fricción al arrastrar hacia arriba
    const y = dy < 0 ? dy * 0.2 : dy
    panel.current.style.transform = `translateY(${y}px)`
  }
  const up = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId || !panel.current) return
    const dy = e.clientY - d.y
    // velocidad sobre la última ventana, no sobre todo el gesto
    const v = Math.abs(e.clientY - d.ly) / Math.max(1, Date.now() - d.lt)
    drag.current = null
    panel.current.removeAttribute('data-drag')
    panel.current.style.transform = ''
    if (dy > 110 || (dy > 20 && v > 0.11)) closeRef.current()
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-backdrop absolute inset-0" data-open={vis} onClick={dismissible ? () => closeRef.current() : undefined} />
      <div
        ref={panel}
        tabIndex={-1}
        data-open={vis}
        className="sheet-panel safe-bottom relative flex max-h-[88%] w-full flex-col rounded-t-[28px] bg-white shadow-2xl outline-none"
      >
        <div className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="h-1.5 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="scroll-y min-h-0 flex-1 px-5 pb-4">{children}</div>
      </div>
    </div>
  )
}
