-- 0020: correcciones de la auditoria de seguridad (2026-11-22).
-- 1) Ubicacion de enfermeras: distancias calculadas sobre celdas de ~1 km y radio fijo; mover el punto propio ya no la delata.
-- 2) Servicios en efectivo: no suman saldo retirable (la plataforma no cobro nada).
-- 3) km_entre acotado (asin fuera de rango con puntos antipodas) y despacho aislado por solicitud.
-- 4) Limite de cancelaciones por paciente (pedir/cancelar en bucle bloqueaba a una enfermera).
-- 5) profiles.color solo hex; el cliente ya no lo puede cambiar.
-- 6) Pago aprobado tarde (servicio cancelado o vencido) queda para reembolso.
-- 7) Revocar a una enfermera cancela y reembolsa sus servicios activos; no puede seguir avanzandolos.
-- 8) nurse_details/profiles solo los crea el trigger de registro.

-- ---------- 3) Distancia sin errores de dominio ----------
create or replace function public.km_entre(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2) +
    cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2)
  )))
$$;

-- Celda de ~1 km (2 decimales). Todo lo que ve un paciente se calcula entre celdas, nunca con coordenadas exactas.
create or replace function public.celda(x double precision) returns double precision
language sql immutable as $$ select round(x::numeric, 2)::double precision $$;

-- ---------- 1) enfermeras_cerca: radio fijo de 10 km y distancias entre celdas ----------
create or replace function public.enfermeras_cerca(p_lat double precision, p_lng double precision, p_radio double precision default 10)
returns table(id uuid, nombre text, color text, calificacion numeric, especialidad text, servicios integer, lat double precision, lng double precision, km double precision)
language sql stable security definer set search_path = public as $$
  -- p_lat, p_lng y p_radio se ignoran: el origen es la ubicacion guardada del paciente y el radio es siempre 10 km.
  with yo as (
    select public.celda(pr.lat) as lat, public.celda(pr.lng) as lng
    from public.profiles pr where pr.id = auth.uid() and pr.rol = 'paciente' and pr.lat is not null and pr.lng is not null
  ), cerca as (
    select p.id, p.nombre, p.color, p.calificacion, d.especialidad, d.servicios,
           public.celda(p.lat) as lat, public.celda(p.lng) as lng,
           public.km_entre(public.celda(p.lat), public.celda(p.lng), yo.lat, yo.lng) as km
    from yo
    cross join public.nurse_details d
    join public.profiles p on p.id = d.usuario_id
    where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado' and p.lat is not null
      and not exists (select 1 from public.servicios x where x.enfermero_id = d.usuario_id and x.estado in ('aceptado', 'en_camino', 'en_atencion'))
      and not exists (select 1 from public.servicios x where x.candidato = d.usuario_id and x.estado = 'solicitado')
  )
  select id, nombre, color, calificacion, especialidad, servicios, lat, lng, round(km::numeric, 1)::double precision
  from cerca where km <= 10
  order by km, id
  limit 20
$$;

-- ---------- 1) cotizar: misma regla de celdas para elegir enfermero y calcular desplazamiento ----------
create or replace function public.cotizar(p_servicio text, p_inmediato boolean, p_lat double precision, p_lng double precision, p_enfermero uuid default null)
returns table(base integer, recargo integer, desplazamiento integer, total integer, enfermero uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_km double precision;
  v_nurse uuid;
begin
  if not exists (select 1 from public.catalogo where id = p_servicio and activo) then raise exception 'servicio_desconocido'; end if;
  select public.celda(pr.lat), public.celda(pr.lng) into v_lat, v_lng
  from public.profiles pr where pr.id = auth.uid() and pr.lat is not null and pr.lng is not null;
  if v_lat is null then raise exception 'sin_ubicacion'; end if;

  select d.usuario_id, public.km_entre(public.celda(p.lat), public.celda(p.lng), v_lat, v_lng) into v_nurse, v_km
  from public.nurse_details d join public.profiles p on p.id = d.usuario_id
  where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado' and p.lat is not null
    and public.km_entre(public.celda(p.lat), public.celda(p.lng), v_lat, v_lng) <= 10
    and (p_enfermero is null or d.usuario_id = p_enfermero)
  order by public.km_entre(public.celda(p.lat), public.celda(p.lng), v_lat, v_lng), d.usuario_id
  limit 1;
  if p_enfermero is not null and v_nurse is null then raise exception 'enfermero_no_disponible'; end if;

  base := coalesce(public.tarifa_de(v_nurse, p_servicio), (select precio_base from public.catalogo where id = p_servicio));
  recargo := case when p_inmediato then round((base * 0.2) / 500) * 500 else 0 end;
  desplazamiento := greatest(2000, round(coalesce(v_km, 3) * 1000 / 500) * 500)::integer;
  total := base + recargo + desplazamiento;
  enfermero := p_enfermero;
  return next;
end $$;

-- ---------- 4) Limite de cancelaciones: 3 por hora frena el bucle pedir/cancelar ----------
alter table public.servicios add column cancelada_por_paciente boolean not null default false;

create or replace function public.cancelar_servicio(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pac uuid := auth.uid();
begin
  -- Solo las cancelaciones con enfermero ofrecido o asignado cuentan (las que molestan a un profesional).
  if (select count(*) from public.servicios
      where paciente_id = v_pac and estado = 'cancelado' and cancelada_por_paciente and estado_ts > now() - interval '1 hour') >= 3 then
    raise exception 'muchas_cancelaciones';
  end if;
  update public.servicios set estado = 'cancelado', estado_ts = now(), candidato = null,
         cancelada_por_paciente = (candidato is not null or enfermero_id is not null)
  where id = p_id and paciente_id = v_pac and estado in ('solicitado', 'aceptado');
  if not found then raise exception 'no_cancelable'; end if;
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select enfermero_id, 'Servicio cancelado', E'El paciente canceló la solicitud.', 'alerta'
  from public.servicios where id = p_id and enfermero_id is not null;
  update public.pagos set estado = 'por_reembolsar' where servicio_id = p_id and estado = 'aprobado';
  if found then
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
    values (v_pac, 'Reembolso en proceso', E'Cancelaste el servicio. Te devolvemos el pago a tu medio original.', 'info');
  end if;
end $$;


-- ---------- 2) y 7) avanzar_servicio: requiere estar aprobado; efectivo no suma saldo retirable ----------
create or replace function public.avanzar_servicio(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios%rowtype;
  v_neto integer;
begin
  if not exists (select 1 from public.nurse_details where usuario_id = auth.uid() and aprobado = 'aprobado') then
    raise exception 'no_aprobado';
  end if;
  select * into s from public.servicios where id = p_id and enfermero_id = auth.uid() for update;
  if not found then raise exception 'no_asignado'; end if;

  if s.estado = 'aceptado' then
    update public.servicios set estado = 'en_camino', estado_ts = now() where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo)
    values (s.paciente_id, 'Tu enfermero va en camino', E'Salió hacia tu ubicación.');
    return 'en_camino';
  elsif s.estado = 'en_camino' and not s.llego then
    update public.servicios set llego = true where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
    values (s.paciente_id, E'¡Tu enfermero llegó!', E'Ya está en tu puerta.', 'exito');
    return 'llego';
  elsif s.estado = 'en_camino' then
    update public.servicios set estado = 'en_atencion', estado_ts = now() where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo)
    values (s.paciente_id, E'Atención iniciada', E'El procedimiento comenzó.');
    return 'en_atencion';
  elsif s.estado = 'en_atencion' then
    update public.servicios set estado = 'completado', estado_ts = now() where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
    values (s.paciente_id, 'Servicio completado', E'Cuéntanos cómo te fue y califica la atención.', 'exito');
    if s.metodo_pago = 'efectivo' then
      -- El paciente le paga en efectivo al profesional: la plataforma no recibio dinero, no hay saldo que retirar.
      -- ponytail: la comision del 15 % de servicios en efectivo no se cobra; llevar una cuenta de deuda si el negocio la exige.
      update public.nurse_details set servicios = servicios + 1 where usuario_id = auth.uid();
      insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
      values (auth.uid(), 'Servicio en efectivo completado', 'Cobra el total directamente al paciente.', 'exito');
    else
      v_neto := round(s.total * 0.85)::integer;
      update public.nurse_details set ganancias = ganancias + v_neto, servicios = servicios + 1 where usuario_id = auth.uid();
      insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
      values (auth.uid(), 'Ganancia registrada', '+ $ ' || replace(to_char(v_neto, 'FM999G999G999'), ',', '.'), 'exito');
    end if;
    return 'completado';
  end if;
  raise exception 'transicion_invalida';
end $$;

-- ---------- 7) Revocar: cancela, reembolsa y avisa ----------
create or replace function public.aprobar_enfermero(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo_admin'; end if;
  update public.nurse_details set aprobado = case when p_ok then 'aprobado' else 'rechazado' end, online = false
  where usuario_id = p_id;
  if not p_ok then
    update public.servicios set candidato = null, oferta_inicio = null where candidato = p_id and estado = 'solicitado';
    with activos as (
      update public.servicios set estado = 'cancelado', estado_ts = now()
      where enfermero_id = p_id and estado in ('aceptado', 'en_camino', 'en_atencion')
      returning id, paciente_id
    ), reemb as (
      update public.pagos p set estado = 'por_reembolsar' from activos a where p.servicio_id = a.id and p.estado = 'aprobado'
      returning p.servicio_id
    )
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
    select paciente_id, 'Servicio cancelado',
           case when exists (select 1 from reemb r where r.servicio_id = a.id)
                then E'El profesional ya no está disponible. Te devolvemos el pago.'
                else E'El profesional ya no está disponible. Puedes pedir otro.' end,
           'alerta'
    from activos a;
  end if;
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  values (p_id,
          case when p_ok then E'¡Perfil aprobado!' else E'Documentación rechazada' end,
          case when p_ok then 'Ya puedes conectarte y recibir servicios.' else E'Revisa tus documentos y vuelve a enviarlos.' end,
          case when p_ok then 'exito' else 'alerta' end);
end $$;

-- ---------- 6) Pago aprobado tarde: si el servicio ya no esta vigente, se reembolsa ----------
create or replace function public.confirmar_pago(p_referencia text, p_estado text, p_wompi_id text, p_monto integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_servicio uuid;
  v_actual text;
  v_estado text := p_estado;
  v_wid text := p_wompi_id;
  v_monto integer;
begin
  select servicio_id, estado, monto_centavos into v_servicio, v_actual, v_monto
  from public.pagos where referencia = p_referencia for update;
  if v_servicio is null then return; end if;

  -- el mismo id de transaccion ya pago otra referencia: no se despacha
  if v_wid is not null and exists (select 1 from public.pagos where wompi_id = v_wid and referencia <> p_referencia) then
    v_estado := 'error';
    v_wid := null;
  end if;
  -- un APPROVED con monto distinto no despacha el servicio
  if v_estado = 'aprobado' and p_monto is distinct from v_monto then
    v_estado := 'error';
  end if;

  if v_actual <> 'pendiente' then
    -- Pago vencido (15 min) que Wompi aprueba despues: se guarda la transaccion y se devuelve.
    if v_actual = 'rechazado' and v_estado = 'aprobado' and v_wid is not null then
      update public.pagos set estado = 'por_reembolsar', wompi_id = v_wid where referencia = p_referencia;
    end if;
    return; -- ya procesado: idempotente
  end if;

  if v_estado = 'aprobado' and (select estado from public.servicios where id = v_servicio) <> 'solicitado' then
    -- El paciente cancelo antes de que llegara la aprobacion: no se despacha, se reembolsa.
    update public.pagos set estado = 'por_reembolsar', wompi_id = v_wid where referencia = p_referencia;
    return;
  end if;

  update public.pagos set estado = v_estado, wompi_id = v_wid where referencia = p_referencia;
  if v_estado = 'aprobado' then
    update public.servicios set pagado = true where id = v_servicio;
    perform public.despachar_seguro();
  else
    update public.servicios set estado = 'cancelado', estado_ts = now() where id = v_servicio and not pagado;
  end if;
end $$;

-- ---------- 3) Despacho aislado por solicitud; sin cobertura si nadie esta a 10 km ----------
CREATE OR REPLACE FUNCTION public.despachar_pendientes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s public.servicios%rowtype;
  v_nurse uuid;
  v_count integer := 0;
begin
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

  with vencidas as (
    update public.servicios
    set rechazados = array_append(rechazados, candidato), candidato = null, oferta_inicio = null
    where estado = 'solicitado' and candidato is not null and oferta_inicio < now() - interval '20 seconds'
    returning rechazados[cardinality(rechazados)] as nurse
  )
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select nurse, 'Solicitud expirada', 'No respondiste a tiempo.', 'alerta' from vencidas;

  for s in select * from public.servicios where estado = 'solicitado' and candidato is null and pagado order by creado for update skip locked loop
    begin
      v_nurse := null;
      select d.usuario_id into v_nurse
      from public.nurse_details d join public.profiles p on p.id = d.usuario_id
      where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado' and p.lat is not null
        and d.usuario_id <> s.paciente_id
        and public.km_entre(p.lat, p.lng, s.lat, s.lng) <= 10
        and not (d.usuario_id = any (s.rechazados))
        and public.tarifa_de(d.usuario_id, s.servicio_id) <= coalesce(s.tarifa, 2147483647)
        and not exists (select 1 from public.servicios x where x.enfermero_id = d.usuario_id and x.estado in ('aceptado','en_camino','en_atencion'))
        and not exists (select 1 from public.servicios x where x.candidato = d.usuario_id and x.estado = 'solicitado')
      order by (d.usuario_id is not distinct from s.preferido) desc, public.km_entre(p.lat, p.lng, s.lat, s.lng)
      limit 1;

      if v_nurse is null then
        -- Sin cobertura solo si no queda ningun profesional activo a 10 km que no la haya rechazado.
        if not exists (select 1 from public.nurse_details d join public.profiles p on p.id = d.usuario_id
                       where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado' and p.lat is not null
                         and public.km_entre(p.lat, p.lng, s.lat, s.lng) <= 10
                         and not (d.usuario_id = any (s.rechazados))
                         and public.tarifa_de(d.usuario_id, s.servicio_id) <= coalesce(s.tarifa, 2147483647)) then
          update public.servicios set estado = 'sin_cobertura', estado_ts = now() where id = s.id;
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
    exception when unique_violation then
      null; -- otra transaccion tomo a esa enfermera: se reintenta en la siguiente pasada
    when others then
      raise warning 'despacho %: %', s.id, sqlerrm; -- una solicitud con datos malos no frena a las demas
    end;
  end loop;
  return v_count;
end $function$;

-- ---------- 5) Color: solo hex de 6 digitos y fuera del alcance del cliente ----------
update public.profiles set color = '#1d6fe8' where color !~ '^#[0-9a-fA-F]{6}$';
alter table public.profiles add constraint color_hex check (color ~ '^#[0-9a-fA-F]{6}$');
revoke update on public.profiles from authenticated;
grant update (nombre, telefono, direccion) on public.profiles to authenticated;

-- ---------- 8) Las filas de perfil y de profesional solo las crea handle_new_user ----------
revoke insert on public.profiles, public.nurse_details from authenticated;

-- ---------- Permisos ----------
revoke execute on function public.celda(double precision) from public, anon;
