import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, inputCls } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAppActions } from '../store/AppContext'
import { AuthShell } from './Login'

/** /recuperar: pide el correo y envía el enlace de recuperación. */
export function Recover() {
  const { requestReset } = useAppActions()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const error = await requestReset(email.trim().toLowerCase())
    setErr(error ?? '')
    setSent(!error)
    setBusy(false)
  }

  return (
    <AuthShell>
      <div className="stagger space-y-5">
        <div style={{ ['--i' as string]: 0 }}>
          <h2 className="text-2xl font-extrabold">Recupera tu contraseña</h2>
          <p className="text-mute">Te enviamos un enlace para crear una nueva.</p>
        </div>
        {sent ? (
          <p role="status" className="rounded-2xl bg-mint-50 p-4 text-[14px] font-semibold text-mint-700" style={{ ['--i' as string]: 1 }}>
            Si el correo está registrado, te llegará un enlace en unos minutos. Revisa también el spam.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3" style={{ ['--i' as string]: 1 }}>
            <Field label="Correo">
              <input className={inputCls} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" enterKeyHint="send" autoComplete="email" required placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {err && <p role="alert" className="text-[13px] font-semibold text-red-600">{err}</p>}
            <Button type="submit" block loading={busy}>
              Enviar enlace <ArrowRight size={18} />
            </Button>
          </form>
        )}
        <button onClick={() => nav('/login')} className="press w-full rounded-2xl py-3 text-[15px] font-semibold text-brand-700" style={{ ['--i' as string]: 2 }}>
          Volver a <span className="underline underline-offset-4">iniciar sesión</span>
        </button>
      </div>
    </AuthShell>
  )
}

/** /restablecer: el enlace del correo abre una sesión de recuperación; aquí se fija la nueva contraseña. */
export function ResetPassword() {
  const { setPassword } = useAppActions()
  const nav = useNavigate()
  // getSession espera a que supabase-js procese el enlace del correo antes de responder.
  const [link, setLink] = useState<'espera' | 'ok' | 'invalido'>('espera')
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLink(data.session ? 'ok' : 'invalido'))
  }, [])
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pass.length < 8) {
      setErr('Usa al menos 8 caracteres.')
      return
    }
    setBusy(true)
    const error = await setPassword(pass)
    setBusy(false)
    if (error) setErr(error)
    else nav('/', { replace: true }) // App lleva a la home del rol
  }

  return (
    <AuthShell>
      <div className="stagger space-y-5">
        <div style={{ ['--i' as string]: 0 }}>
          <h2 className="text-2xl font-extrabold">Nueva contraseña</h2>
          <p className="text-mute">Elige una contraseña que no uses en otro sitio.</p>
        </div>
        {link === 'espera' ? null : link === 'ok' ? (
          <form onSubmit={submit} className="space-y-3" style={{ ['--i' as string]: 1 }}>
            <Field label="Nueva contraseña">
              <input className={inputCls} type="password" enterKeyHint="go" autoComplete="new-password" required minLength={8} placeholder="Mínimo 8 caracteres" value={pass} onChange={(e) => setPass(e.target.value)} />
            </Field>
            {err && <p role="alert" className="text-[13px] font-semibold text-red-600">{err}</p>}
            <Button type="submit" block loading={busy}>
              Guardar contraseña <ArrowRight size={18} />
            </Button>
          </form>
        ) : (
          <div className="space-y-3" style={{ ['--i' as string]: 1 }}>
            <p role="alert" className="text-[14px] text-mute">El enlace no es válido o ya venció. Pide uno nuevo.</p>
            <Button block onClick={() => nav('/recuperar')}>Pedir otro enlace</Button>
          </div>
        )}
      </div>
    </AuthShell>
  )
}
