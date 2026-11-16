import { Bell, HeartPulse, type LucideIcon } from 'lucide-react'
import { Suspense, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { timeAgo } from '../lib/format'
import { useApp } from '../store/AppContext'
import { Sheet } from './Sheet'
import { Toasts } from './Toasts'

export interface Tab {
  to: string
  label: string
  icon: LucideIcon
}

export function Layout({ tabs, badge }: { tabs: Tab[]; badge: string }) {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const { state, me, markAllRead } = useApp()
  const [open, setOpen] = useState(false)
  const mine = state.notifs.filter((n) => n.userId === me?.id)
  const unread = mine.filter((n) => !n.leida).length

  const idx = Math.max(
    0,
    tabs.findIndex((t, i) => (i === 0 ? pathname === t.to : pathname.startsWith(t.to))),
  )
  const hideTabs = /\/(seguimiento|solicitar)/.test(pathname)

  return (
    <div className="app-shell">
      <Toasts />
      <header className="safe-top flex shrink-0 items-center justify-between relative z-10 bg-gradient-to-r from-brand-800 via-brand-600 to-brand-500 px-5 pb-3 text-white shadow-[0_10px_26px_-12px_rgba(20,48,95,0.55)]">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-brand-600">
            <HeartPulse size={18} />
          </span>
          <span className="text-[18px] font-extrabold tracking-tight tracking-tight">
            Enfermera<span className="text-mint-400">Ya</span>
          </span>
          <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-white">{badge}</span>
        </div>
        <button
          aria-label="Notificaciones"
          onClick={() => {
            setOpen(true)
            markAllRead()
          }}
          className="press relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[12px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      </header>

      <main key={pathname} className={`relative min-h-0 flex-1 ${hideTabs ? 'page-enter' : 'tab-enter pt-3'}`}>
        <Suspense fallback={<div className="flex h-full items-center justify-center" role="status" aria-label="Cargando"><span className="spin h-8 w-8 rounded-full border-4 border-brand-100 border-t-brand-600" /></div>}>
          <Outlet />
        </Suspense>
      </main>

      {!hideTabs && (
        <nav className="safe-bottom relative z-10 shrink-0 border-t border-white/60 bg-white/80 px-2 pt-1.5 shadow-[0_-10px_28px_-14px_rgba(20,48,95,0.3)] backdrop-blur-xl">
          <div className="relative grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {/* Pastilla de la pestaña activa: se desliza de una a otra */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 top-2 flex justify-center transition-transform duration-300 ease-[var(--ease-in-out)]"
              style={{ width: `${100 / tabs.length}%`, transform: `translateX(${idx * 100}%)` }}
            >
              <span className="h-8 w-16 rounded-full bg-brand-50" />
            </span>
            {tabs.map((t, i) => {
              const I = t.icon
              const on = i === idx
              return (
                <button
                  key={t.to}
                  onClick={() => nav(t.to)}
                  aria-current={on ? 'page' : undefined}
                  className={`press relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-[12px] font-semibold ${on ? 'text-brand-600' : 'text-mute'}`}
                >
                  <span className="flex h-8 w-16 items-center justify-center"><I size={22} strokeWidth={on ? 2.4 : 2} /></span>
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Notificaciones">
        <h2 className="mb-3 text-xl font-extrabold">Notificaciones</h2>
        {mine.length === 0 ? (
          <p className="py-10 text-center text-mute">Aquí verás las novedades de tus servicios.</p>
        ) : (
          <ul className="space-y-2 pb-2">
            {mine.slice(0, 20).map((n, i) => (
              <li key={n.id} style={{ ['--i' as string]: Math.min(i, 8) }} className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{n.titulo}</span>
                  <span className="shrink-0 text-xs text-mute">{timeAgo(n.ts)}</span>
                </div>
                <p className="text-sm text-mute">{n.cuerpo}</p>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  )
}
