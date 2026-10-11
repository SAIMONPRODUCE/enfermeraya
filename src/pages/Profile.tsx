import { LogOut, Mail, Phone, RotateCcw, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Button, Card } from '../components/ui'
import { useApp } from '../store/AppContext'

export default function Profile() {
  const { me, myNurse, logout, reset } = useApp()
  const nav = useNavigate()
  if (!me) return null
  return (
    <div className="scroll-y h-full px-5 pb-6">
      <div className="stagger space-y-4">
        <div className="flex flex-col items-center gap-2 pt-2 text-center" style={{ ['--i' as string]: 0 }}>
          <Avatar name={me.nombre} color={me.color} size={84} />
          <h1 className="text-2xl font-extrabold">{me.nombre}</h1>
          <p className="flex items-center gap-1 text-[14px] capitalize text-mute">
            {me.rol} {me.rol !== 'admin' && <><span>·</span><Star size={14} fill="#f59e0b" strokeWidth={0} /> {me.calificacion.toFixed(1)}</>}
          </p>
          {myNurse && <p className="text-[13px] font-semibold text-brand-700">{myNurse.especialidad}</p>}
        </div>
        <Card>
          <div className="space-y-3 text-[14px]">
            <p className="flex items-center gap-3"><Mail size={18} className="text-mute" />{me.email}</p>
            <p className="flex items-center gap-3"><Phone size={18} className="text-mute" />{me.telefono}</p>
          </div>
        </Card>
        <Button block variant="ghost" onClick={() => { logout(); nav('/login', { replace: true }) }}><LogOut size={18} /> Cerrar sesión / Cambiar de rol</Button>
        <button onClick={() => { reset(); nav('/login', { replace: true }) }} className="press flex w-full items-center justify-center gap-2 py-3 text-[13px] font-semibold text-mute">
          <RotateCcw size={15} /> Reiniciar datos de demo
        </button>
      </div>
    </div>
  )
}
