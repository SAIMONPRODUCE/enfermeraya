import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  dismissible?: boolean
}

/** Bottom sheet con drag-to-dismiss (umbral de distancia o velocidad > 0.11 px/ms). */
export function Sheet({ open, onClose, children, title, dismissible = true }: Props) {
  const [mounted, setMounted] = useState(open)
  const [vis, setVis] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; t: number; id: number } | null>(null)

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

  if (!mounted) return null

  const down = (e: React.PointerEvent) => {
    if (!dismissible || drag.current) return
    drag.current = { y: e.clientY, t: Date.now(), id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
    panel.current?.setAttribute('data-drag', 'true')
  }
  const move = (e: React.PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId || !panel.current) return
    const dy = e.clientY - drag.current.y
    // fricción al arrastrar hacia arriba
    const y = dy < 0 ? dy * 0.2 : dy
    panel.current.style.transform = `translateY(${y}px)`
  }
  const up = (e: React.PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId || !panel.current) return
    const dy = e.clientY - drag.current.y
    const v = Math.abs(dy) / Math.max(1, Date.now() - drag.current.t)
    drag.current = null
    panel.current.removeAttribute('data-drag')
    panel.current.style.transform = ''
    if (dy > 110 || (dy > 20 && v > 0.11)) onClose()
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-backdrop absolute inset-0" data-open={vis} onClick={dismissible ? onClose : undefined} />
      <div
        ref={panel}
        data-open={vis}
        className="sheet-panel safe-bottom relative flex max-h-[88%] w-full flex-col rounded-t-[28px] bg-white shadow-2xl"
      >
        <div className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="h-1.5 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="scroll-y min-h-0 flex-1 px-5 pb-4">{children}</div>
      </div>
    </div>
  )
}
