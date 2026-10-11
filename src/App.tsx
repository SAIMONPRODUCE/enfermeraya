import { Activity as ActivityIcon, ClipboardList, Home, LayoutDashboard, ShieldCheck, User, Wallet } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useApp } from './store/AppContext'
import type { Role } from './types'
import { Operations, Validations } from './pages/admin/Admin'
import Login, { homeOf } from './pages/Login'
import Earnings from './pages/nurse/Earnings'
import NurseHome from './pages/nurse/Home'
import Activity from './pages/patient/Activity'
import PatientHome from './pages/patient/Home'
import Request from './pages/patient/Request'
import Tracking from './pages/patient/Tracking'
import Profile from './pages/Profile'
import Register from './pages/Register'

function Guard({ role, children }: { role: Role; children: React.ReactNode }) {
  const { me } = useApp()
  if (!me) return <Navigate to="/login" replace />
  if (me.rol !== role) return <Navigate to={homeOf(me.rol)} replace />
  return <>{children}</>
}

const patientTabs = [
  { to: '/p', label: 'Inicio', icon: Home },
  { to: '/p/actividad', label: 'Actividad', icon: ClipboardList },
  { to: '/p/perfil', label: 'Perfil', icon: User },
]
const nurseTabs = [
  { to: '/n', label: 'Servicios', icon: ActivityIcon },
  { to: '/n/ganancias', label: 'Ganancias', icon: Wallet },
  { to: '/n/perfil', label: 'Perfil', icon: User },
]
const adminTabs = [
  { to: '/a', label: 'Validaciones', icon: ShieldCheck },
  { to: '/a/operaciones', label: 'Operaciones', icon: LayoutDashboard },
  { to: '/a/perfil', label: 'Perfil', icon: User },
]

export default function App() {
  const { me } = useApp()
  return (
    <Routes>
      <Route path="/login" element={me ? <Navigate to={homeOf(me.rol)} replace /> : <Login />} />
      <Route path="/registro" element={me ? <Navigate to={homeOf(me.rol)} replace /> : <Register />} />

      <Route path="/p" element={<Guard role="paciente"><Layout tabs={patientTabs} badge="Paciente" /></Guard>}>
        <Route index element={<PatientHome />} />
        <Route path="solicitar" element={<Request />} />
        <Route path="seguimiento/:id" element={<Tracking />} />
        <Route path="actividad" element={<Activity />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      <Route path="/n" element={<Guard role="enfermero"><Layout tabs={nurseTabs} badge="Socio" /></Guard>}>
        <Route index element={<NurseHome />} />
        <Route path="ganancias" element={<Earnings />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      <Route path="/a" element={<Guard role="admin"><Layout tabs={adminTabs} badge="Admin" /></Guard>}>
        <Route index element={<Validations />} />
        <Route path="operaciones" element={<Operations />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to={me ? homeOf(me.rol) : '/login'} replace />} />
    </Routes>
  )
}
