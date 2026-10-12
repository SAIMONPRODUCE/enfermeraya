-- 0015: presencia del profesional. Un profesional solo recibe ofertas si esta en linea Y su app reporto actividad
-- en los ultimos 2 minutos. Sin esto, una sesion caida o una pestana oculta seguia "en linea" y las ofertas se perdian.

alter table public.nurse_details add column visto timestamptz not null default now();

create or replace function public.nurse_activa(p_online boolean, p_visto timestamptz) returns boolean
language sql stable set search_path = public as $$
  select p_online and p_visto > now() - interval '2 minutes'
$$;

-- Latido: la app del profesional lo llama cada 30 s mientras esta en linea y visible.
create or replace function public.latido() returns void
language sql security definer set search_path = public as $$
  update public.nurse_details set visto = now() where usuario_id = auth.uid() and online;
$$;
grant execute on function public.latido() to authenticated;
revoke execute on function public.latido() from anon, public;

CREATE OR REPLACE FUNCTION public.aceptar_oferta(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pac uuid;
begin
  if not exists (select 1 from public.nurse_details where usuario_id = auth.uid() and aprobado = 'aprobado' and public.nurse_activa(online, visto)) then
    raise exception 'no_disponible';
  end if;
  update public.servicios
  set enfermero_id = auth.uid(), estado = 'aceptado', estado_ts = now()
  where id = p_id and candidato = auth.uid() and estado = 'solicitado'
  returning paciente_id into v_pac;
  if not found then raise exception 'oferta_no_valida'; end if;
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  values (v_pac, E'\u00a1Enfermero asignado!', 'Tu solicitud fue aceptada.', 'exito');
end $function$;

CREATE OR REPLACE FUNCTION public.cotizar(p_servicio text, p_inmediato boolean, p_lat double precision, p_lng double precision)
 RETURNS TABLE(base integer, recargo integer, desplazamiento integer, total integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_base integer;
  v_cercana double precision;
begin
  select precio_base into v_base from public.catalogo where id = p_servicio;
  if v_base is null then raise exception 'servicio_desconocido'; end if;

  select min(public.km_entre(p.lat, p.lng, p_lat, p_lng)) into v_cercana
  from public.nurse_details d join public.profiles p on p.id = d.usuario_id
  where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado' and p.lat is not null
    and public.km_entre(p.lat, p.lng, p_lat, p_lng) <= 10;

  base := v_base;
  recargo := case when p_inmediato then round((v_base * 0.2) / 500) * 500 else 0 end;
  desplazamiento := greatest(2000, round(coalesce(v_cercana, 3) * 1000 / 500) * 500)::integer;
  total := base + recargo + desplazamiento;
  return next;
end $function$;

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
    where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado' and p.lat is not null
      and public.km_entre(p.lat, p.lng, s.lat, s.lng) <= 10
      and not (d.usuario_id = any (s.rechazados))
      and not exists (select 1 from public.servicios x where x.enfermero_id = d.usuario_id and x.estado in ('aceptado','en_camino','en_atencion'))
      and not exists (select 1 from public.servicios x where x.candidato = d.usuario_id and x.estado = 'solicitado')
    order by public.km_entre(p.lat, p.lng, s.lat, s.lng)
    limit 1;

    if v_nurse is null then
      -- sin cobertura solo si no quedan enfermeras en linea que aun no la rechazaron
      if not exists (select 1 from public.nurse_details d where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado' and not (d.usuario_id = any (s.rechazados))) then
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
end $function$;

CREATE OR REPLACE FUNCTION public.enfermeras_cerca(p_lat double precision, p_lng double precision, p_radio double precision DEFAULT 10)
 RETURNS TABLE(id uuid, nombre text, color text, calificacion numeric, especialidad text, servicios integer, lat double precision, lng double precision, km double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with yo as (
    select pr.lat, pr.lng from public.profiles pr where pr.id = auth.uid() and pr.rol = 'paciente' and pr.lat is not null and pr.lng is not null
  )
  select p.id, p.nombre, p.color, p.calificacion, d.especialidad, d.servicios,
         round(p.lat::numeric, 2)::double precision, round(p.lng::numeric, 2)::double precision,
         round(public.km_entre(p.lat, p.lng, yo.lat, yo.lng)::numeric, 1)::double precision as km
  from yo
  cross join public.nurse_details d
  join public.profiles p on p.id = d.usuario_id
  where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado' and p.lat is not null
    and public.km_entre(p.lat, p.lng, yo.lat, yo.lng) <= least(p_radio, 10)
    and not exists (select 1 from public.servicios x where x.enfermero_id = d.usuario_id and x.estado in ('aceptado', 'en_camino', 'en_atencion'))
    and not exists (select 1 from public.servicios x where x.candidato = d.usuario_id and x.estado = 'solicitado')
  order by public.km_entre(p.lat, p.lng, yo.lat, yo.lng)
  limit 20
$function$;

CREATE OR REPLACE FUNCTION public.set_online(p_online boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.nurse_details set online = p_online, visto = now()
  where usuario_id = auth.uid() and aprobado = 'aprobado';
  if not found then raise exception 'no_aprobado'; end if;
  if p_online then perform public.despachar_seguro(); end if;
end $function$;
