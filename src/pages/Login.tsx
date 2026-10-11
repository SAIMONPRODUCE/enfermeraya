import { ArrowRight, HeartPulse, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, inputCls } from '../components/ui'
import { useAppActions } from '../store/AppContext'
import type { Role } from '../types'

export const homeOf = (r: Role) => (r === 'paciente' ? '/p' : r === 'enfermero' ? '/n' : '/a')

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

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon?: LucideIcon }[] }) {
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
  const { login } = useAppActions()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Al entrar, App redirige a la home del rol en cuanto carga el perfil.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const error = await login(email.trim().toLowerCase(), pass)
    setErr(error ?? '')
    setBusy(false)
  }

  return (
    <AuthShell>
      <div className="stagger space-y-5">
        <div style={{ ['--i' as string]: 0 }}>
          <h2 className="text-2xl font-extrabold">Bienvenido 👋</h2>
          <p className="text-mute">Entra con tu correo y contraseña.</p>
        </div>
        <form onSubmit={submit} className="space-y-3" style={{ ['--i' as string]: 1 }}>
          <Field label="Correo">
            <input className={inputCls} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" enterKeyHint="next" autoComplete="email" required placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña">
            <input className={inputCls} type="password" enterKeyHint="go" autoComplete="current-password" required placeholder="••••••••" value={pass} onChange={(e) => setPass(e.target.value)} />
          </Field>
          {err && <p role="alert" className="text-[13px] font-semibold text-red-600">{err}</p>}
          <Button type="submit" block loading={busy}>
            Entrar <ArrowRight size={18} />
          </Button>
        </form>

        <button onClick={() => nav('/registro')} className="press w-full rounded-2xl py-3 text-[15px] font-semibold text-brand-700" style={{ ['--i' as string]: 2 }}>
          ¿Nuevo aquí? <span className="underline underline-offset-4">Crear cuenta</span>
        </button>
      </div>
    </AuthShell>
  )
}
