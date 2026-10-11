// Devuelve la URL de Wompi Checkout para el pago pendiente de un servicio del paciente.
// Secrets: WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET (llaves de sandbox mientras se pruebe).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { servicio_id, redirect_url } = await req.json().catch(() => ({}))
  if (typeof servicio_id !== 'string' || typeof redirect_url !== 'string') return json({ error: 'datos_invalidos' }, 400)

  // Cliente con el JWT del paciente: la RLS de `pagos` decide qué fila ve.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: pago, error } = await db
    .from('pagos')
    .select('referencia, monto_centavos, estado')
    .eq('servicio_id', servicio_id)
    .maybeSingle()
  if (error || !pago) return json({ error: 'pago_no_encontrado' }, 404)
  if (pago.estado !== 'pendiente') return json({ error: 'pago_ya_procesado' }, 409)

  const currency = 'COP'
  const integrity = await sha256Hex(
    `${pago.referencia}${pago.monto_centavos}${currency}${Deno.env.get('WOMPI_INTEGRITY_SECRET')!}`,
  )
  const url = new URL('https://checkout.wompi.co/p/')
  url.searchParams.set('public-key', Deno.env.get('WOMPI_PUBLIC_KEY')!)
  url.searchParams.set('currency', currency)
  url.searchParams.set('amount-in-cents', String(pago.monto_centavos))
  url.searchParams.set('reference', pago.referencia)
  url.searchParams.set('signature:integrity', integrity)
  url.searchParams.set('redirect-url', redirect_url)
  return json({ url: url.toString() })
})
