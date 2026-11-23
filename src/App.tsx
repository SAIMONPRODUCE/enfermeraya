import { Activity as ActivityIcon, Banknote, ClipboardList, Home, LayoutDashboard, ShieldCheck, User, Wallet } from 'lucide-react'
import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useApp } from './store/AppContext'
import type { Role } from './types'
import { APP_NOMBRE, APP_ROL, appUrl } from './lib/app'
import Login, { AuthShell, homeOf } from './pages/Login'
import { Recover, ResetPassword } from './pages/Recover'
import Activity from './pages/patient/Activity'
import PatientHome from './pages/patient/Home'
import Profile from './pages/Profile'
import { Privacidad, Terminos } from './pages/Legal'
import Register from './pages/Register'

// Rutas por rol y flujos pesados (mapa, pago) se cargan al entrar: el inicio de paciente y el login quedan ligeros.
const Operations = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.Operations })))
const Validations = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.Validations })))
const Withdrawals = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.Withdrawals })))
const Earnings = lazy(() => import('./pages/nurse/Earnings'))
const NurseHome = lazy(() => import('./pages/nurse/Home'))
const Request = lazy(() => import('./pages/patient/Request'))
const Tracking = lazy(() => import('./pages/patient/Tracking'))

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
  { to: '/a/retiros', label: 'Retiros', icon: Banknote },
  { to: '/a/perfil', label: 'Perfil', icon: User },
]

/** Una cuenta de otro tipo entró en esta app: no ve nada y se le manda a la suya. */
function OtraApp({ rol }: { rol: Role }) {
  const { logout } = useApp()
  return (
    <AuthShell>
      <div className="space-y-4 text-center">
        <h2 className="text-[24px] font-extrabold leading-tight tracking-tight">Esta cuenta no es de {APP_NOMBRE[APP_ROL]}</h2>
        <p className="text-mute">Tu cuenta es de {APP_NOMBRE[rol]}. Entra por su app.</p>
        <a href={appUrl(rol)} className="press flex h-12 items-center justify-center rounded-2xl bg-brand-600 font-bold text-white">Ir a la app de {APP_NOMBRE[rol]}</a>
        <button onClick={logout} className="press w-full py-2 text-[14px] font-semibold text-mute">Salir</button>
      </div>
    </AuthShell>
  )
}

export default function App() {
  const { me } = useApp()
  if (me && me.rol !== APP_ROL && !/\/(terminos|privacidad)$/.test(location.pathname)) return <OtraApp rol={me.rol} />
  const home = homeOf(APP_ROL)
  return (
    <Routes>
      <Route path="/login" element={me ? <Navigate to={home} replace /> : <Login />} />
      {APP_ROL !== 'admin' && <Route path="/registro" element={me ? <Navigate to={home} replace /> : <Register />} />}
      <Route path="/recuperar" element={me ? <Navigate to={home} replace /> : <Recover />} />
      <Route path="/terminos" element={<Terminos />} />
      <Route path="/privacidad" element={<Privacidad />} />
      {/* El enlace del correo abre una sesión de recuperación: no redirigir aunque `me` exista. */}
      <Route path="/restablecer" element={<ResetPassword />} />

      {APP_ROL === 'paciente' && (
        <Route path="/p" element={<Guard role="paciente"><Layout tabs={patientTabs} badge="Paciente" /></Guard>}>
          <Route index element={<PatientHome />} />
          <Route path="solicitar" element={<Request />} />
          <Route path="seguimiento/:id" element={<Tracking />} />
          <Route path="actividad" element={<Activity />} />
          <Route path="perfil" element={<Profile />} />
        </Route>
      )}

      {APP_ROL === 'enfermero' && (
        <Route path="/n" element={<Guard role="enfermero"><Layout tabs={nurseTabs} badge="Socio" /></Guard>}>
          <Route index element={<NurseHome />} />
          <Route path="ganancias" element={<Earnings />} />
          <Route path="perfil" element={<Profile />} />
        </Route>
      )}

      {APP_ROL === 'admin' && (
        <Route path="/a" element={<Guard role="admin"><Layout tabs={adminTabs} badge="Admin" /></Guard>}>
          <Route index element={<Validations />} />
          <Route path="operaciones" element={<Operations />} />
          <Route path="retiros" element={<Withdrawals />} />
          <Route path="perfil" element={<Profile />} />
        </Route>
      )}

      <Route path="*" element={<Navigate to={me ? home : '/login'} replace />} />
    </Routes>
  )
}
