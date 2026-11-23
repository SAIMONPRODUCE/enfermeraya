import { ArrowLeft, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Check, Field, inputCls } from '../components/ui'
import { useAppActions } from '../store/AppContext'
import { APP_BASE, APP_ROL } from '../lib/app'
import { AuthShell } from './Login'

type Kind = 'paciente' | 'enfermero'
const ESPECIALIDADES = ['Enfermera/o profesional', 'Inyectología y terapia IV', 'Curaciones', 'Postoperatorio', 'Cuidado de adulto mayor']

export default function Register() {
  const nav = useNavigate()
  const { register } = useAppActions()
  // El tipo de cuenta lo da la app: la de clientes crea pacientes y la de profesionales, enfermeros.
  const kind: Kind = APP_ROL === 'enfermero' ? 'enfermero' : 'paciente'
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [password, setPassword] = useState('')
  const [esp, setEsp] = useState(ESPECIALIDADES[0])
  const [documento, setDocumento] = useState('')
  const [reps, setReps] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [autoriza, setAutoriza] = useState(false)
  const [profesional, setProfesional] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)

  // Mismos límites que los CHECK de la tabla profiles (nombre 3-80, teléfono 7-20).
  const tel = telefono.replace(/[^\d+]/g, '')
  const doc = documento.replace(/\D/g, '')
  const repsNum = reps.replace(/\D/g, '')
  const nurseOk = kind !== 'enfermero' || (profesional && /^\d{5,12}$/.test(doc) && /^\d{6,15}$/.test(repsNum))
  const valid = nombre.trim().length >= 3 && /\S+@\S+\.\S+/.test(email) && tel.length >= 7 && tel.length <= 20 && password.length >= 8 && acepta && autoriza && nurseOk

  // Con sesión, App redirige a la home del rol en cuanto carga el perfil.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    const mail = email.trim().toLowerCase()
    const { error, needsConfirm } = await register({
      rol: kind, nombre: nombre.trim().slice(0, 80), email: mail, telefono: tel, password,
      especialidad: kind === 'enfermero' ? esp : undefined,
      documento: kind === 'enfermero' ? doc : undefined,
      reps: kind === 'enfermero' ? repsNum : undefined,
    })
    setBusy(false)
    setErr(error ?? '')
    if (needsConfirm) setSentTo(mail)
  }

  if (sentTo)
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mint-50 text-mint-700"><MailCheck size={30} /></span>
          <h2 className="text-[26px] font-extrabold leading-tight tracking-tight">Revisa tu correo</h2>
          <p className="max-w-[280px] text-mute">Te enviamos un enlace a <b className="text-ink">{sentTo}</b>. Confírmalo y luego entra con tu contraseña.</p>
          <Button block className="mt-2" onClick={() => nav('/login', { replace: true })}>Ir a entrar</Button>
        </div>
      </AuthShell>
    )

  return (
    <AuthShell>
      <button onClick={() => nav('/login')} className="press -ml-2 mb-3 flex items-center gap-1 rounded-xl px-2 py-1.5 text-[14px] font-semibold text-mute">
        <ArrowLeft size={18} /> Volver
      </button>
      <h2 className="text-[26px] font-extrabold leading-tight tracking-tight">Crea tu cuenta</h2>
      <p className="mb-5 text-mute">{kind === 'enfermero' ? 'Cuenta de profesional de enfermería.' : 'Toma menos de un minuto.'}</p>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nombre completo">
          <input className={inputCls} autoComplete="name" enterKeyHint="next" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ana Martínez" />
        </Field>
        <Field label="Correo">
          <input className={inputCls} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" enterKeyHint="next" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </Field>
        <Field label="Teléfono">
          <input className={inputCls} type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="300 123 4567" />
        </Field>
        <Field label="Contraseña">
          <input className={inputCls} type="password" autoComplete="new-password" enterKeyHint="done" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
        </Field>

        {kind === 'enfermero' && (
          <div key="nurse" className="step-enter space-y-3 pt-1">
            <Field label="Especialidad">
              <select className={inputCls} value={esp} onChange={(e) => setEsp(e.target.value)}>
                {ESPECIALIDADES.map((x) => (<option key={x}>{x}</option>))}
              </select>
            </Field>
            <Field label="Cédula">
              <input className={inputCls} inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Para verificar tu inscripción en ReTHUS" />
            </Field>
            <Field label="Código REPS de prestador independiente">
              <input className={inputCls} inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="Código de habilitación" />
            </Field>
            <Check on={profesional} onChange={setProfesional}>Soy enfermera o enfermero <b>profesional</b> con tarjeta profesional, inscrito en ReTHUS y en el REPS. No soy auxiliar de enfermería.</Check>
            <p className="rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-700">Después de crear tu cuenta subirás tu tarjeta profesional y diploma. Un administrador los revisará antes de que recibas servicios.</p>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <Check on={acepta} onChange={setAcepta}>Acepto los <a href={`${APP_BASE}terminos`} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">términos y condiciones</a> y la <a href={`${APP_BASE}privacidad`} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">política de datos</a>.</Check>
          <Check on={autoriza} onChange={setAutoriza}>Autorizo de forma expresa el tratamiento de mis datos de <b>salud</b> y de <b>ubicación</b> para prestar el servicio.</Check>
        </div>
        {err && <p role="alert" className="text-[13px] font-semibold text-red-600">{err}</p>}
        <Button type="submit" block loading={busy} disabled={!valid} className="mt-2">
          {kind === 'paciente' ? 'Crear cuenta' : 'Crear cuenta profesional'}
        </Button>
      </form>
    </AuthShell>
  )
}

