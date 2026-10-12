-- 0014: reembolsos. Un pago aprobado se devuelve si el paciente cancela antes de que el profesional salga
-- o si no hay cobertura. La base marca el pago 'por_reembolsar'; un job cada minuto llama a la Edge Function
-- wompi-reembolso (anulacion en Wompi). Tras 5 intentos fallidos pasa a 'reembolso_manual' y se avisa a los admin.

create extension if not exists pg_net;

alter table public.pagos drop constraint pagos_estado_check;
alter table public.pagos add constraint pagos_estado_check
  check (estado in ('pendiente', 'aprobado', 'rechazado', 'error', 'por_reembolsar', 'reembolsado', 'reembolso_manual'));
alter table public.pagos add column reembolso_intentos integer not null default 0;
alter table public.pagos add column reembolso_nota text;

-- Cancelar: si el servicio ya estaba pagado, el pago queda por reembolsar.
create or replace function public.cancelar_servicio(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pac uuid := auth.uid();
begin
  update public.servicios set estado = 'cancelado', estado_ts = now(), candidato = null
  where id = p_id and paciente_id = auth.uid() and estado in ('solicitado', 'aceptado');
  if not found then raise exception 'no_cancelable'; end if;
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select enfermero_id, 'Servicio cancelado', E'El paciente cancel\u00f3 la solicitud.', 'alerta'
  from public.servicios where id = p_id and enfermero_id is not null;
  update public.pagos set estado = 'por_reembolsar' where servicio_id = p_id and estado = 'aprobado';
  if found then
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
    values (v_pac, 'Reembolso en proceso', E'Cancelaste el servicio. Te devolvemos el pago a tu medio original.', 'info');
  end if;
end $$;

create or replace function public.despachar_pendientes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios%rowtype;
  v_nurse uuid;
  v_count integer := 0;
begin
  -- 0) Pagos vencidos: sin cobro en 15 min, se cancela y se cierra el pago.
  with vencidos as (
    update public.servicios
    set estado = 'cancelado', estado_ts = now()
    where estado = 'solicitado' and pagado = false and creado < now() - interval '15 minutes'
    returning id, paciente_id
  ), pagos_cerrados as (
    update public.pagos p set estado = 'rechazado'
    from vencidos v where p.servicio_id = v.id and p.estado = 'pendiente'
    returning p.servicio_id
  )
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select paciente_id, 'Solicitud cancelada', 'No se recibio el pago a tiempo. No se hizo ningun cobro.', 'alerta' from vencidos;

  -- 1) Ofertas vencidas (>20 s): pasan a la siguiente enfermera y se avisa a la que no respondio.
  with vencidas as (
    update public.servicios
    set rechazados = array_append(rechazados, candidato), candidato = null, oferta_inicio = null
    where estado = 'solicitado' and candidato is not null and oferta_inicio < now() - interval '20 seconds'
    returning rechazados[cardinality(rechazados)] as nurse
  )
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select nurse, 'Solicitud expirada', 'No respondiste a tiempo.', 'alerta' from vencidas;

  -- 2) Solicitudes pagadas sin candidato: la enfermera libre mas cercana que no la haya rechazado
  for s in select * from public.servicios where estado = 'solicitado' and candidato is null and pagado order by creado for update skip locked loop
    select d.usuario_id into v_nurse
    from public.nurse_details d join public.profiles p on p.id = d.usuario_id
    where d.online and d.aprobado = 'aprobado' and p.lat is not null
      and public.km_entre(p.lat, p.lng, s.lat, s.lng) <= 10
      and not (d.usuario_id = any (s.rechazados))
      and not exists (select 1 from public.servicios x where x.enfermero_id = d.usuario_id and x.estado in ('aceptado','en_camino','en_atencion'))
      and not exists (select 1 from public.servicios x where x.candidato = d.usuario_id and x.estado = 'solicitado')
    order by public.km_entre(p.lat, p.lng, s.lat, s.lng)
    limit 1;

    if v_nurse is null then
      -- sin cobertura solo si no quedan enfermeras en linea que aun no la rechazaron
      if not exists (select 1 from public.nurse_details d where d.online and d.aprobado = 'aprobado' and not (d.usuario_id = any (s.rechazados))) then
        update public.servicios set estado = 'sin_cobertura', estado_ts = now() where id = s.id;
        -- si ya pago (tarjeta o transferencia), se devuelve el dinero
        update public.pagos set estado = 'por_reembolsar' where servicio_id = s.id and estado = 'aprobado';
        insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
        values (s.paciente_id, 'Sin profesionales cerca',
                case when exists (select 1 from public.pagos where servicio_id = s.id and estado = 'por_reembolsar')
                     then 'Ahora no hay enfermeros disponibles. Te devolveremos el pago.'
                     else 'Ahora no hay enfermeros disponibles.' end,
                'alerta');
      end if;
    else
      update public.servicios set candidato = v_nurse, oferta_inicio = now() where id = s.id;
      insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
      values (v_nurse, 'Nueva solicitud cerca', 'Hay una solicitud a tu alrededor.', 'alerta');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

-- Resultado de la anulacion en Wompi (lo llama solo la Edge Function con service_role).
create or replace function public.registrar_reembolso(p_referencia text, p_ok boolean, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pac uuid;
begin
  if p_ok then
    update public.pagos set estado = 'reembolsado', reembolso_nota = p_nota
    where referencia = p_referencia and estado = 'por_reembolsar';
    if found then
      select s.paciente_id into v_pac from public.pagos p join public.servicios s on s.id = p.servicio_id where p.referencia = p_referencia;
      insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
      values (v_pac, 'Reembolso realizado', E'Anulamos tu pago. Puede tardar unos d\u00edas en verse en tu cuenta.', 'exito');
    end if;
  else
    update public.pagos set reembolso_nota = left(p_nota, 400) where referencia = p_referencia and estado = 'por_reembolsar';
  end if;
end $$;

-- Job (cada minuto): pide a la Edge Function cada reembolso pendiente; tras 5 intentos pasa a manual.
create or replace function public.procesar_reembolsos() returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_secret text;
begin
  with manuales as (
    update public.pagos set estado = 'reembolso_manual'
    where estado = 'por_reembolsar' and reembolso_intentos >= 5
    returning referencia
  )
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select a.id, 'Reembolso manual requerido', 'El pago ' || m.referencia || ' no se pudo anular solo. Hazlo desde Wompi.', 'alerta'
  from manuales m cross join public.profiles a where a.rol = 'admin';

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'reembolso_secret';
  if v_secret is null then return; end if;
  for r in select referencia from public.pagos where estado = 'por_reembolsar' and reembolso_intentos < 5 order by creado limit 5 loop
    update public.pagos set reembolso_intentos = reembolso_intentos + 1 where referencia = r.referencia;
    -- ponytail: URL del proyecto fija; si cambia el proyecto, actualizar aqui.
    perform net.http_post(
      url := 'https://dhlsicuhklkasxianwho.supabase.co/functions/v1/wompi-reembolso',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body := jsonb_build_object('referencia', r.referencia));
  end loop;
end $$;

revoke all on function public.registrar_reembolso(text, boolean, text) from public, anon, authenticated;
grant execute on function public.registrar_reembolso(text, boolean, text) to service_role;
revoke all on function public.procesar_reembolsos() from public, anon, authenticated;

select cron.schedule('procesar-reembolsos', '* * * * *', 'select public.procesar_reembolsos()');
