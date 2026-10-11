import { ArrowLeft, Check, FileText, Upload } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, inputCls } from '../components/ui'
import { useApp } from '../store/AppContext'
import { AuthShell, Segmented, homeOf } from './Login'

type Kind = 'paciente' | 'enfermero'
const ESPECIALIDADES = ['Enfermera/o profesional', 'Inyectología y terapia IV', 'Curaciones', 'Postoperatorio', 'Cuidado de adulto mayor', 'Toma de muestras']

function DocSlot({ label, file, onPick }: { label: string; file: string | null; onPick: (f: string) => void }) {
  return (
    <label className={`press flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-3 transition-colors duration-200 ${file ? 'border-mint-400 bg-mint-50' : 'border-slate-300 bg-white'}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${file ? 'bg-mint-500 text-white' : 'bg-slate-100 text-mute'}`}>
        {file ? <Check size={20} /> : <Upload size={20} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{label}</span>
        <span className="block truncate text-[13px] text-mute">{file ?? 'Toca para adjuntar PDF o foto'}</span>
      </span>
      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0].name)} />
    </label>
  )
}

export default function Register() {
  const nav = useNavigate()
  const { registerPatient, registerNurse } = useApp()
  const [kind, setKind] = useState<Kind>('paciente')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [esp, setEsp] = useState(ESPECIALIDADES[0])
  const [tp, setTp] = useState<string | null>(null)
  const [dip, setDip] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const valid = nombre.trim().length > 2 && /\S+@\S+\.\S+/.test(email) && telefono.length >= 7 && (kind === 'paciente' || (tp && dip))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setTimeout(() => {
      const base = { nombre: nombre.trim(), email: email.trim().toLowerCase(), telefono }
      if (kind === 'paciente') registerPatient(base)
      else registerNurse({ ...base, especialidad: esp, docs: [tp!, dip!] })
      nav(homeOf(kind), { replace: true })
    }, 700)
  }

  return (
    <AuthShell>
      <button onClick={() => nav('/login')} className="press -ml-2 mb-3 flex items-center gap-1 rounded-xl px-2 py-1.5 text-[14px] font-semibold text-mute">
        <ArrowLeft size={18} /> Volver
      </button>
      <h2 className="text-2xl font-extrabold">Crea tu cuenta</h2>
      <p className="mb-5 text-mute">Toma menos de un minuto.</p>
      <Segmented value={kind} onChange={setKind} options={[{ id: 'paciente', label: 'Soy paciente' }, { id: 'enfermero', label: 'Soy profesional' }]} />
      <form onSubmit={submit} className="mt-5 space-y-3">
        <Field label="Nombre completo">
          <input className={inputCls} autoComplete="name" enterKeyHint="next" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ana Martínez" />
        </Field>
        <Field label="Correo">
          <input className={inputCls} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" enterKeyHint="next" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </Field>
        <Field label="Teléfono">
          <input className={inputCls} type="tel" inputMode="tel" enterKeyHint="done" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="300 123 4567" />
        </Field>

        {kind === 'enfermero' && (
          <div key="nurse" className="step-enter space-y-3 pt-1">
            <Field label="Especialidad">
              <select className={inputCls} value={esp} onChange={(e) => setEsp(e.target.value)}>
                {ESPECIALIDADES.map((x) => (<option key={x}>{x}</option>))}
              </select>
            </Field>
            <p className="flex items-center gap-2 pt-1 text-[13px] font-bold text-mute"><FileText size={15} /> Documentos de validación</p>
            <DocSlot label="Tarjeta profesional" file={tp} onPick={setTp} />
            <DocSlot label="Diploma o título" file={dip} onPick={setDip} />
            <p className="rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-700">Un administrador revisará tu perfil. Quedará <b>pendiente de aprobación</b> antes de recibir servicios.</p>
          </div>
        )}

        <Button type="submit" block loading={busy} disabled={!valid} className="mt-2">
          {kind === 'paciente' ? 'Crear cuenta' : 'Enviar para aprobación'}
        </Button>
      </form>
    </AuthShell>
  )
}
