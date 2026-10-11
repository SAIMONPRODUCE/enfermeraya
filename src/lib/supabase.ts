import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

// Códigos que lanzan las RPC (raise exception) y Auth, en español para el usuario.
const ERRORES: Record<string, string> = {
  solo_pacientes: 'Solo los pacientes pueden solicitar servicios.',
  fecha_invalida: 'Elige una fecha y hora futuras.',
  servicio_desconocido: 'Ese servicio no existe.',
  no_cancelable: 'Este servicio ya no se puede cancelar.',
  no_calificable: 'Este servicio ya fue calificado.',
  no_aprobado: 'Tu perfil aún no está aprobado.',
  no_disponible: 'Conéctate para aceptar servicios.',
  oferta_no_valida: 'La solicitud expiró o ya fue asignada.',
  no_asignado: 'Este servicio no está asignado a ti.',
  transicion_invalida: 'El servicio ya avanzó.',
  solo_admin: 'Solo un administrador puede hacer esto.',
  ruta_invalida: 'Los documentos no son válidos.',
  no_editable: 'Tu perfil ya fue aprobado.',
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu correo antes de entrar. Revisa tu bandeja.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
}

export const errorMsg = (e: { message: string }) => ERRORES[e.message] ?? e.message
