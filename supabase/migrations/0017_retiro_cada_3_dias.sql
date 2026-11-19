-- 0017: un profesional puede pedir un retiro cada 3 dias. Se cuenta desde su ultimo retiro pendiente o pagado;
-- un retiro rechazado no cuenta, para que pueda volver a pedir.

create or replace function public.solicitar_retiro(p_monto integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ganancias integer;
  v_comprometido integer;
  v_cuenta public.cuentas_cobro;
  v_id uuid;
begin
  -- Bloquea la fila del profesional: dos retiros simultaneos no pueden gastar el mismo saldo.
  select ganancias into v_ganancias from public.nurse_details
  where usuario_id = auth.uid() and aprobado = 'aprobado' for update;
  if not found then raise exception 'no_aprobado'; end if;
  select * into v_cuenta from public.cuentas_cobro where usuario_id = auth.uid();
  if not found then raise exception 'sin_cuenta'; end if;
  if p_monto is null or p_monto < 50000 then raise exception 'monto_minimo'; end if;
  if exists (select 1 from public.retiros where usuario_id = auth.uid() and estado = 'pendiente') then raise exception 'retiro_pendiente'; end if;
  -- Un retiro cada 3 dias, contado desde el ultimo pedido que no fue rechazado (un rechazo no gasta el turno).
  if exists (select 1 from public.retiros where usuario_id = auth.uid() and estado <> 'rechazado' and creado > now() - interval '3 days') then raise exception 'retiro_reciente'; end if;
  select coalesce(sum(monto), 0) into v_comprometido from public.retiros
  where usuario_id = auth.uid() and estado in ('pendiente', 'pagado');
  if p_monto > v_ganancias - v_comprometido then raise exception 'saldo_insuficiente'; end if;

  insert into public.retiros (usuario_id, monto, metodo, banco, tipo_cuenta, numero, titular)
  values (auth.uid(), p_monto, v_cuenta.metodo, v_cuenta.banco, v_cuenta.tipo_cuenta, v_cuenta.numero, v_cuenta.titular)
  returning id into v_id;

  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select id, 'Retiro por pagar', 'Un profesional pidió retirar $ ' || to_char(p_monto, 'FM999G999G999'), 'info'
  from public.profiles where rol = 'admin';
  return v_id;
end $$;
