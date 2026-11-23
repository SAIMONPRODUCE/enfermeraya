import { createClient } from '@supabase/supabase-js'
import { APP_ROL } from './app'

// Sesión separada por app: entrar como admin en /admin/ no deja sesión abierta en la app de clientes, ni al revés.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { storageKey: `ey-auth-${APP_ROL}` },
})

// Códigos que lanzan las RPC (raise exception) y Auth, en español para el usuario.
const ERRORES: Record<string, string> = {
  solo_pacientes: 'Solo los pacientes pueden solicitar servicios.',
  servicio_en_curso: 'Ya tienes un servicio en curso. Cancélalo o espera a que termine.',
  sin_ubicacion: 'Elige tu ubicación antes de pedir un servicio.',
  ubicacion_invalida: 'La ubicación no es válida.',
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
  solo_profesionales: 'Esta opción es solo para profesionales.',
  cuenta_invalida: 'Revisa los datos de la cuenta: número de 7 a 20 dígitos y nombre del titular.',
  sin_cuenta: 'Guarda primero tu cuenta de cobro.',
  monto_minimo: 'El retiro mínimo es $ 50.000.',
  saldo_insuficiente: 'No tienes saldo suficiente para ese monto.',
  retiro_reciente: 'Solo puedes retirar una vez cada 3 días.',
  retiro_pendiente: 'Ya tienes un retiro pendiente. Espera a que se pague.',
  retiro_no_pendiente: 'Ese retiro ya fue resuelto.',
  referencia_requerida: 'Escribe la referencia del pago.',
  nota_requerida: 'Escribe el motivo del rechazo.',
  tarifa_fuera_de_rango: 'La tarifa debe estar dentro del rango del servicio.',
  enfermero_no_disponible: 'Ese profesional ya no está disponible. Elige otro o el más cercano.',
  muchas_cancelaciones: 'Cancelaste varias solicitudes en la última hora. Espera un rato antes de cancelar otra.',
  deuda_pendiente: 'Tienes comisiones de efectivo por pagar sobre el límite. Págalas para volver a conectarte.',
  abono_invalido: 'El monto debe ser mayor a cero y no superar lo que debe.',
  orden_requerida: 'Adjunta la orden médica para este servicio.',
  faltan_registros: 'Falta la cédula o el código REPS del profesional.',
  registros_invalidos: 'Revisa la cédula (5 a 12 dígitos) y el código REPS (6 a 15 dígitos).',
  terminos_desactualizados: 'Recarga la app para ver la versión vigente de los términos.',
  'Database error saving new user': 'No pudimos crear la cuenta. Acepta los términos y revisa los datos.',
  ruta_invalida: 'Los documentos no son válidos.',
  no_editable: 'Tu perfil ya fue aprobado.',
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu correo antes de entrar. Revisa tu bandeja.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
}

export const errorMsg = (e: { message: string }) => ERRORES[e.message] ?? e.message
