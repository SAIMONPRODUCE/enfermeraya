// Anula en Wompi un pago marcado 'por_reembolsar'. Lo llama el job procesar_reembolsos (pg_net) cada minuto.
// Desplegar con --no-verify-jwt: no hay usuario; la autenticidad la da el secreto compartido x-cron-secret.
// Secrets: REEMBOLSO_SECRET (el mismo que esta en Vault como reembolso_secret) y WOMPI_PRIVATE_KEY (llave privada de pruebas o produccion).
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const esperado = Deno.env.get('REEMBOLSO_SECRET')
  if (!esperado || req.headers.get('x-cron-secret') !== esperado) return new Response('no autorizado', { status: 401 })

  const { referencia } = await req.json().catch(() => ({}))
  if (typeof referencia !== 'string') return new Response('datos_invalidos', { status: 400 })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const resultado = (ok: boolean, nota: string | null) => db.rpc('registrar_reembolso', { p_referencia: referencia, p_ok: ok, p_nota: nota })

  const { data: pago } = await db.from('pagos').select('wompi_id, monto_centavos, estado').eq('referencia', referencia).maybeSingle()
  if (!pago || pago.estado !== 'por_reembolsar') return new Response('nada que hacer', { status: 200 })
  if (!pago.wompi_id) {
    await resultado(false, 'sin id de transaccion de Wompi')
    return new Response('sin_transaccion', { status: 200 })
  }

  const key = Deno.env.get('WOMPI_PRIVATE_KEY')
  if (!key) {
    await resultado(false, 'falta el secret WOMPI_PRIVATE_KEY')
    return new Response('sin_llave', { status: 500 })
  }
  const api = key.startsWith('prv_prod_') ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1'

  const res = await fetch(`${api}/transactions/${encodeURIComponent(pago.wompi_id)}/void`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount_in_cents: pago.monto_centavos }),
  }).catch(() => null)
  const body = res ? await res.json().catch(() => null) : null
  const estado = body?.data?.status
  // Solo se da por reembolsado si Wompi acepto la anulacion; cualquier otra respuesta queda registrada para reintentar.
  if (res?.ok && (estado === 'APPROVED' || estado === 'PENDING')) {
    await resultado(true, `anulado en Wompi (${estado})`)
    return new Response('ok', { status: 200 })
  }
  await resultado(false, `Wompi respondio ${res?.status ?? 'sin respuesta'}: ${JSON.stringify(body?.error ?? body ?? '').slice(0, 300)}`)
  return new Response('reintentar', { status: 502 })
})
