import { Bell, HeartPulse, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
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
      <header className="safe-top flex shrink-0 items-center justify-between bg-white/90 px-5 pb-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white">
            <HeartPulse size={18} />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">
            Enfermera<span className="text-brand-600">Ya</span>
          </span>
          <span className="ml-1 rounded-full bg-mint-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-mint-600">{badge}</span>
        </div>
        <button
          aria-label="Notificaciones"
          onClick={() => {
            setOpen(true)
            markAllRead()
          }}
          className="press relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-ink"
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      </header>

      <main key={pathname} className="page-enter relative min-h-0 flex-1">
        <Outlet />
      </main>

      {!hideTabs && (
        <nav className="safe-bottom relative z-10 shrink-0 border-t border-slate-100 bg-white px-2 pt-1.5">
          <div className="relative grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            <span
              className="absolute left-0 top-0 h-[3px] rounded-full bg-brand-600 transition-transform duration-300 ease-[var(--ease-in-out)]"
              style={{ width: `${100 / tabs.length}%`, transform: `translateX(${idx * 100}%) scaleX(0.4)` }}
            />
            {tabs.map((t, i) => {
              const I = t.icon
              const on = i === idx
              return (
                <button
                  key={t.to}
                  onClick={() => nav(t.to)}
                  aria-current={on ? 'page' : undefined}
                  className={`press flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold ${on ? 'text-brand-600' : 'text-mute'}`}
                >
                  <I size={22} strokeWidth={on ? 2.4 : 2} />
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
          <ul className="stagger space-y-2 pb-2">
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
