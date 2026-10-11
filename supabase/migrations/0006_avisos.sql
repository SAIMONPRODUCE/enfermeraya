-- 0006: avisos al profesional que faltaban frente a la simulacion local.
--  * Oferta vencida: "Solicitud expirada" (despachar_pendientes).
--  * Servicio completado: "Ganancia registrada" con el 85 % (avanzar_servicio).
-- Solo ASCII: acentos como E'\u00..'.

create or replace function public.despachar_pendientes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios%rowtype;
  v_nurse uuid;
  v_count integer := 0;
begin
  -- 1) Ofertas vencidas (>20 s): pasan a la siguiente enfermera y se avisa a la que no respondio.
  --    rechazados[cardinality] es el candidato recien agregado.
  with vencidas as (
    update public.servicios
    set rechazados = array_append(rechazados, candidato), candidato = null, oferta_inicio = null
    where estado = 'solicitado' and candidato is not null and oferta_inicio < now() - interval '20 seconds'
    returning rechazados[cardinality(rechazados)] as nurse
  )
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select nurse, 'Solicitud expirada', 'No respondiste a tiempo.', 'alerta' from vencidas;

  -- 2) Solicitudes sin candidato: la enfermera libre mas cercana que no la haya rechazado
  for s in select * from public.servicios where estado = 'solicitado' and candidato is null order by creado for update skip locked loop
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

create or replace function public.avanzar_servicio(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios%rowtype;
  v_neto integer;
begin
  select * into s from public.servicios where id = p_id and enfermero_id = auth.uid() for update;
  if not found then raise exception 'no_asignado'; end if;

  if s.estado = 'aceptado' then
    update public.servicios set estado = 'en_camino', estado_ts = now() where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo)
    values (s.paciente_id, 'Tu enfermero va en camino', E'Sali\u00f3 hacia tu ubicaci\u00f3n.');
    return 'en_camino';
  elsif s.estado = 'en_camino' and not s.llego then
    update public.servicios set llego = true where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
    values (s.paciente_id, E'\u00a1Tu enfermero lleg\u00f3!', E'Ya est\u00e1 en tu puerta.', 'exito');
    return 'llego';
  elsif s.estado = 'en_camino' then
    update public.servicios set estado = 'en_atencion', estado_ts = now() where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo)
    values (s.paciente_id, E'Atenci\u00f3n iniciada', E'El procedimiento comenz\u00f3.');
    return 'en_atencion';
  elsif s.estado = 'en_atencion' then
    v_neto := round(s.total * 0.85)::integer;
    update public.servicios set estado = 'completado', estado_ts = now() where id = p_id;
    update public.nurse_details
    set ganancias = ganancias + v_neto, servicios = servicios + 1
    where usuario_id = auth.uid();
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo) values
      (s.paciente_id, 'Servicio completado', E'Cu\u00e9ntanos c\u00f3mo te fue y califica la atenci\u00f3n.', 'exito'),
      -- formato es-CO: $ 37.400 (to_char con locale C usa coma de miles)
      (auth.uid(), 'Ganancia registrada', '+ $ ' || replace(to_char(v_neto, 'FM999G999G999'), ',', '.'), 'exito');
    return 'completado';
  end if;
  raise exception 'transicion_invalida';
end $$;
