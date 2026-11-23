import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TERMINOS_VERSION } from '../lib/legal'

// BORRADOR para revisión de un abogado en Colombia (salud, laboral, datos). Los datos entre [corchetes] los completa la empresa.
const EMPRESA = '[RAZÓN SOCIAL] S.A.S., NIT [NÚMERO], domiciliada en Bogotá D.C.'
const CONTACTO = '[correo de contacto] · [teléfono]'

function Doc({ titulo, children }: { titulo: string; children: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="app-shell">
      <div className="scroll-y h-full px-5 pb-10 pt-[max(env(safe-area-inset-top,0px),20px)]">
        <button onClick={() => nav(-1)} className="press -ml-2 mb-3 flex items-center gap-1 rounded-xl px-2 py-1.5 text-[14px] font-semibold text-mute">
          <ArrowLeft size={18} /> Volver
        </button>
        <article className="space-y-4 rounded-3xl bg-white p-5 text-[14px] leading-relaxed text-ink shadow-sm [&_h2]:mt-5 [&_h2]:text-[17px] [&_h2]:font-extrabold [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
          <p className="rounded-2xl bg-amber-50 p-3 text-[13px] font-semibold text-amber-800">Borrador pendiente de revisión legal. Versión {TERMINOS_VERSION}.</p>
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight">{titulo}</h1>
          {children}
        </article>
      </div>
    </div>
  )
}

export function Terminos() {
  return (
    <Doc titulo="Términos y condiciones">
      <p>EnfermeraYa es una plataforma tecnológica operada por {EMPRESA} («la plataforma»). Al crear una cuenta aceptas estos términos.</p>

      <h2>1. Qué hace la plataforma</h2>
      <p>La plataforma conecta a personas que necesitan atención de enfermería en casa con <b>profesionales de enfermería independientes</b>. La plataforma <b>no presta servicios de salud</b>, no es una IPS y no dirige la atención: cada profesional decide cómo realiza el procedimiento y responde por él.</p>
      <p><b>No es un servicio de urgencias.</b> Si alguien está en riesgo, llama al 123.</p>

      <h2>2. Profesionales</h2>
      <ul>
        <li>Solo se aceptan enfermeras y enfermeros profesionales con tarjeta profesional, inscripción en ReTHUS e inscripción en el REPS como profesional independiente. No se aceptan auxiliares de enfermería como prestadores.</li>
        <li>Antes de activarse, un administrador revisa sus documentos y registros. La verificación no reemplaza la responsabilidad profesional de cada uno.</li>
        <li>El profesional es independiente: puede conectarse, desconectarse y rechazar solicitudes cuando quiera, sin exclusividad ni horarios.</li>
        <li>Cada profesional fija su tarifa dentro del rango publicado y debe estar al día en seguridad social, contar con póliza de responsabilidad civil y cumplir la Ley 266 de 1996 y la Ley 911 de 2004.</li>
        <li>La historia clínica y el consentimiento informado son responsabilidad del profesional.</li>
      </ul>

      <h2>3. Pacientes y familiares</h2>
      <ul>
        <li>Debes dar información veraz, una dirección real y notas útiles para la atención.</li>
        <li>Inyectología y terapia intravenosa exigen adjuntar la orden médica.</li>
        <li>Ves el precio total antes de pedir: tarifa del profesional, desplazamiento y recargo si es inmediato.</li>
      </ul>

      <h2>4. Pagos</h2>
      <ul>
        <li>Con tarjeta, Nequi o PSE pagas a través de Wompi. La plataforma recibe el pago como <b>mandataria</b> del profesional y le transfiere su parte (85 %); conserva una comisión del 15 %.</li>
        <li>En efectivo pagas el total al profesional al terminar. El profesional le debe a la plataforma la comisión del 15 %.</li>
        <li>La plataforma factura solo su comisión. El servicio de salud lo factura el profesional cuando la ley lo exija.</li>
      </ul>

      <h2>5. Cancelaciones, reembolsos y retracto</h2>
      <ul>
        <li>Puedes cancelar sin costo mientras el profesional no haya salido hacia tu dirección. Si ya pagaste, te devolvemos el total a tu medio de pago original.</li>
        <li>Si no hay profesionales disponibles, o el profesional deja de estar habilitado, se cancela el servicio y se devuelve el pago.</li>
        <li>Por tratarse de un servicio que empieza a prestarse en la fecha acordada, el derecho de retracto no aplica una vez iniciada la atención (Ley 1480 de 2011, art. 47).</li>
      </ul>

      <h2>6. Uso correcto</h2>
      <p>No se permite crear cuentas falsas, pedir servicios sin intención de recibirlos, cancelar de forma abusiva ni tratar mal a otros usuarios. La plataforma puede limitar o suspender cuentas por estas razones, según reglas públicas y con derecho a explicarte.</p>

      <h2>7. Responsabilidad</h2>
      <p>La plataforma responde por el funcionamiento de la app, la verificación documental que anuncia y el manejo de los pagos. La atención de salud es responsabilidad del profesional que la presta.</p>

      <h2>8. Quejas y contacto</h2>
      <p>Peticiones, quejas y reclamos: {CONTACTO}. Respondemos en máximo 15 días hábiles. También puedes acudir a la Superintendencia de Industria y Comercio.</p>

      <h2>9. Cambios</h2>
      <p>Si cambiamos estos términos te pediremos aceptarlos de nuevo en la app.</p>
    </Doc>
  )
}

export function Privacidad() {
  return (
    <Doc titulo="Política de tratamiento de datos personales">
      <p>Responsable: {EMPRESA}. Contacto para datos personales: {CONTACTO}. Esta política cumple la Ley 1581 de 2012 y el Decreto 1377 de 2013.</p>

      <h2>1. Qué datos tratamos</h2>
      <ul>
        <li>Identificación y contacto: nombre, correo, teléfono.</li>
        <li><b>Ubicación</b>: la dirección donde pides el servicio y, para profesionales conectados, la ubicación del dispositivo para asignar servicios y mostrar el recorrido.</li>
        <li><b>Datos de salud (datos sensibles)</b>: el tipo de servicio, tus notas, la orden médica y la calificación.</li>
        <li>Profesionales: cédula, código REPS, tarjeta profesional, diploma y datos de la cuenta donde reciben pagos.</li>
        <li>Pagos: estado y referencia de la transacción. No guardamos números de tarjeta; los procesa Wompi.</li>
      </ul>

      <h2>2. Para qué</h2>
      <ul>
        <li>Conectar a pacientes con profesionales cercanos, cobrar y pagar los servicios.</li>
        <li>Verificar la habilitación de los profesionales.</li>
        <li>Mostrar al profesional asignado la información necesaria para la atención (dirección, notas y orden médica) y al paciente el recorrido del profesional.</li>
        <li>Atender quejas, prevenir fraude y cumplir obligaciones legales y tributarias.</li>
      </ul>

      <h2>3. Datos sensibles</h2>
      <p>Tus datos de salud y de ubicación son sensibles. No estás obligado a darlos, pero sin ellos no podemos prestar el servicio. Los tratamos solo con tu <b>autorización expresa</b>, que das al crear tu cuenta.</p>

      <h2>4. Con quién los compartimos</h2>
      <ul>
        <li>Con el profesional asignado a tu servicio, solo durante y para esa atención.</li>
        <li>Con proveedores que actúan por nuestra cuenta: Supabase (alojamiento de la base de datos, servidores en São Paulo, Brasil), Wompi (pagos) y el servicio de correo. Esto implica transferencia internacional de datos con las garantías de ley.</li>
        <li>Con autoridades cuando la ley lo exija.</li>
      </ul>

      <h2>5. Tus derechos</h2>
      <p>Puedes conocer, actualizar, rectificar y pedir la supresión de tus datos, revocar la autorización y pedir prueba de ella, escribiendo a {CONTACTO}. Consultas: respuesta en 10 días hábiles. Reclamos: 15 días hábiles. Si no quedas satisfecho puedes acudir a la Superintendencia de Industria y Comercio.</p>

      <h2>6. Conservación y seguridad</h2>
      <p>Guardamos los datos mientras tengas cuenta y después durante el tiempo que exijan las normas contables, tributarias y de salud. Usamos acceso restringido por usuario, archivos privados y conexiones cifradas.</p>
    </Doc>
  )
}
