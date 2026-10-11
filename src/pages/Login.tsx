import { ArrowRight, HeartPulse, Phone, ShieldCheck, Stethoscope, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, inputCls } from '../components/ui'
import { useApp } from '../store/AppContext'
import type { Role } from '../types'

export const homeOf = (r: Role) => (r === 'paciente' ? '/p' : r === 'enfermero' ? '/n' : '/a')

const ROLES: { id: Role; label: string; icon: typeof UserRound; demo: string }[] = [
  { id: 'paciente', label: 'Paciente', icon: UserRound, demo: 'p1' },
  { id: 'enfermero', label: 'Enfermero', icon: Stethoscope, demo: 'n1' },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, demo: 'a1' },
]

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <div className="scroll-y h-full">
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-mint-500 px-6 pb-14 pt-[max(env(safe-area-inset-top,0px),40px)] text-white">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="page-enter relative">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-lg">
              <HeartPulse size={30} />
            </span>
            <h1 className="mt-5 text-[32px] font-extrabold leading-tight tracking-tight">EnfermeraYa</h1>
            <p className="mt-1 max-w-[260px] text-[15px] text-white/85">Enfermería profesional en tu casa, en minutos.</p>
          </div>
        </div>
        <div className="relative -mt-8 rounded-t-[32px] bg-[#f6f9fd] px-6 pb-10 pt-7">{children}</div>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: typeof UserRound }[] }) {
  const i = options.findIndex((o) => o.id === value)
  return (
    <div className="relative grid rounded-2xl bg-slate-200/70 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span
        className="absolute bottom-1 left-1 top-1 rounded-xl bg-white shadow-sm transition-transform duration-300 ease-[var(--ease-in-out)]"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => {
        const I = o.icon
        return (
          <button key={o.id} onClick={() => onChange(o.id)} className={`press relative z-10 flex h-10 items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold transition-colors duration-200 ${value === o.id ? 'text-brand-700' : 'text-mute'}`}>
            {I && <I size={16} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default function Login() {
  const { state, login } = useApp()
  const nav = useNavigate()
  const [role, setRole] = useState<Role>('paciente')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const enter = (userId: string, key: string) => {
    setBusy(key)
    setTimeout(() => {
      const u = state.users.find((x) => x.id === userId)!
      login(userId)
      nav(homeOf(u.rol), { replace: true })
    }, 600)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found = state.users.find((u) => u.email === email.trim().toLowerCase() && u.rol === role)
    enter(found?.id ?? ROLES.find((r) => r.id === role)!.demo, 'form')
  }

  return (
    <AuthShell>
      <div className="stagger space-y-5">
        <div style={{ ['--i' as string]: 0 }}>
          <h2 className="text-2xl font-extrabold">Bienvenido 👋</h2>
          <p className="text-mute">Elige cómo quieres entrar.</p>
        </div>
        <div style={{ ['--i' as string]: 1 }}>
          <Segmented value={role} onChange={setRole} options={ROLES.map(({ id, label, icon }) => ({ id, label, icon }))} />
        </div>
        <form onSubmit={submit} className="space-y-3" style={{ ['--i' as string]: 2 }}>
          <Field label="Correo">
            <input className={inputCls} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" enterKeyHint="next" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña">
            <input className={inputCls} type="password" enterKeyHint="go" placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)} />
          </Field>
          <Button type="submit" block loading={busy === 'form'}>
            Entrar <ArrowRight size={18} />
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400" style={{ ['--i' as string]: 3 }}>
          <span className="h-px flex-1 bg-slate-200" /> o continúa con <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="grid grid-cols-2 gap-3" style={{ ['--i' as string]: 4 }}>
          <Button variant="ghost" loading={false} onClick={() => enter('p1', 'g')}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
            Google
          </Button>
          <Button variant="ghost" onClick={() => enter('p1', 'tel')}>
            <Phone size={18} /> Teléfono
          </Button>
        </div>

        <button onClick={() => nav('/registro')} className="press w-full rounded-2xl py-3 text-[15px] font-semibold text-brand-700" style={{ ['--i' as string]: 5 }}>
          ¿Nuevo aquí? <span className="underline underline-offset-4">Crear cuenta</span>
        </button>

        <div className="rounded-3xl border border-dashed border-brand-200 bg-brand-50/60 p-4" style={{ ['--i' as string]: 6 }}>
          <p className="mb-3 text-[13px] font-bold text-brand-800">⚡ Modo demo · entra sin registrarte</p>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button key={r.id} onClick={() => enter(r.demo, r.id)} className="press flex flex-col items-center gap-1.5 rounded-2xl bg-white py-3 text-[13px] font-semibold shadow-sm">
                {busy === r.id ? <span className="spin h-5 w-5 rounded-full border-2 border-brand-200 border-t-brand-600" /> : <r.icon size={20} className="text-brand-600" />}
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AuthShell>
  )
}
