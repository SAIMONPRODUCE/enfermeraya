-- 0009: cancela solicitudes con tarjeta sin pagar tras 15 min (despachar_pendientes, cada 5 s por pg_cron).

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
        insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
        values (s.paciente_id, 'Sin profesionales cerca', 'Ahora no hay enfermeros disponibles.', 'alerta');
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
