// Recibe los eventos de Wompi (transaction.updated), valida la firma y confirma el pago.
// Desplegar con --no-verify-jwt: Wompi no manda JWT. La autenticidad la da el checksum.
// Secrets: WOMPI_EVENTS_SECRET (secreto de eventos de sandbox).
import { createClient } from 'jsr:@supabase/supabase-js@2'

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// "transaction.id" -> event.data.transaction.id
const pick = (obj: any, path: string) => path.split('.').reduce((o, k) => o?.[k], obj)

const ESTADOS: Record<string, string> = { APPROVED: 'aprobado', DECLINED: 'rechazado', VOIDED: 'rechazado', ERROR: 'error' }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 })
  const event = await req.json().catch(() => null)
  if (!event?.signature || !event?.data) return new Response('bad', { status: 400 })

  const concatenado =
    event.signature.properties.map((p: string) => String(pick(event.data, p))).join('') +
    String(event.timestamp) +
    Deno.env.get('WOMPI_EVENTS_SECRET')!
  if ((await sha256Hex(concatenado)) !== event.signature.checksum) return new Response('firma', { status: 401 })

  const tx = event.data.transaction
  const estado = ESTADOS[tx?.status]
  if (event.event !== 'transaction.updated' || !estado) return new Response('ignorado', { status: 200 })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await db.rpc('confirmar_pago', { p_referencia: tx.reference, p_estado: estado, p_wompi_id: tx.id })
  if (error) return new Response('error', { status: 500 })
  return new Response('ok', { status: 200 })
})
