-- 0018: cada profesional fija su tarifa por servicio dentro de un rango publico.
-- Sin tarifa propia se usa el precio sugerido (catalogo.precio_base). El paciente puede elegir profesional;
-- si no, se cotiza con el mas cercano. El despacho solo ofrece el servicio a quien cobra igual o menos de lo pagado,
-- y la oferta muestra el monto: aceptarla es aceptar ese precio.

alter table public.catalogo
  add column precio_min integer,
  add column precio_max integer;
update public.catalogo set
  precio_min = (round(precio_base * 0.7 / 1000) * 1000)::integer,
  precio_max = (round(precio_base * 1.6 / 1000) * 1000)::integer;
alter table public.catalogo
  alter column precio_min set not null,
  alter column precio_max set not null,
  add constraint rango_valido check (precio_min > 0 and precio_min <= precio_base and precio_base <= precio_max);

create table public.tarifas (
  enfermero_id uuid not null references public.profiles(id) on delete cascade,
  servicio_id text not null references public.catalogo(id),
  precio integer not null check (precio > 0),
  actualizado timestamptz not null default now(),
  primary key (enfermero_id, servicio_id)
);
alter table public.tarifas enable row level security;
-- Las tarifas son publicas para quien usa la app: el paciente compara antes de pedir.
create policy tarifas_select on public.tarifas for select to authenticated using (true);
grant select on public.tarifas to authenticated;

alter table public.servicios
  add column preferido uuid references public.profiles(id),
  add column tarifa integer;

create or replace function public.tarifa_de(p_enfermero uuid, p_servicio text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select precio from public.tarifas where enfermero_id = p_enfermero and servicio_id = p_servicio),
    (select precio_base from public.catalogo where id = p_servicio))
$$;

create or replace function public.set_tarifa(p_servicio text, p_precio integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.nurse_details where usuario_id = auth.uid()) then
    raise exception 'solo_profesionales';
  end if;
  if not exists (select 1 from public.catalogo where id = p_servicio and p_precio between precio_min and precio_max) then
    raise exception 'tarifa_fuera_de_rango';
  end if;
  insert into public.tarifas (enfermero_id, servicio_id, precio) values (auth.uid(), p_servicio, p_precio)
  on conflict (enfermero_id, servicio_id) do update set precio = excluded.precio, actualizado = now();
end $$;

-- cotizar: el lugar siempre es la ubicacion guardada de quien pregunta (p_lat/p_lng se ignoran).
-- Antes aceptaba coordenadas del cliente y, con p_enfermero, permitiria ubicar a un profesional por distancias.
drop function public.cotizar(text, boolean, double precision, double precision);
create function public.cotizar(p_servicio text, p_inmediato boolean, p_lat double precision, p_lng double precision, p_enfermero uuid default null)
returns table(base integer, recargo integer, desplazamiento integer, total integer, enfermero uuid)
language plpgsql stable security definer set search_path = public as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_km double precision;
  v_nurse uuid;
begin
  if not exists (select 1 from public.catalogo where id = p_servicio) then raise exception 'servicio_desconocido'; end if;
  select pr.lat, pr.lng into v_lat, v_lng from public.profiles pr where pr.id = auth.uid() and pr.lat is not null and pr.lng is not null;
  if v_lat is null then raise exception 'sin_ubicacion'; end if;

  select d.usuario_id, public.km_entre(p.lat, p.lng, v_lat, v_lng) into v_nurse, v_km
  from public.nurse_details d join public.profiles p on p.id = d.usuario_id
  where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado' and p.lat is not null
    and public.km_entre(p.lat, p.lng, v_lat, v_lng) <= 10
    and (p_enfermero is null or d.usuario_id = p_enfermero)
  order by public.km_entre(p.lat, p.lng, v_lat, v_lng)
  limit 1;
  if p_enfermero is not null and v_nurse is null then raise exception 'enfermero_no_disponible'; end if;

  base := coalesce(public.tarifa_de(v_nurse, p_servicio), (select precio_base from public.catalogo where id = p_servicio));
  recargo := case when p_inmediato then round((base * 0.2) / 500) * 500 else 0 end;
  desplazamiento := greatest(2000, round(coalesce(v_km, 3) * 1000 / 500) * 500)::integer;
  total := base + recargo + desplazamiento;
  enfermero := p_enfermero; -- solo se devuelve el elegido: no revela quien es el mas cercano
  return next;
end $$;

drop function public.solicitar_servicio(text, boolean, timestamptz, text, text, double precision, double precision, text);
create function public.solicitar_servicio(
  p_servicio text, p_inmediato boolean, p_fecha timestamptz, p_notas text,
  p_metodo text, p_lat double precision, p_lng double precision, p_direccion text, p_enfermero uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_total integer;
  v_base integer;
  v_lat double precision;
  v_lng double precision;
  v_dir text;
  v_cobra_wompi boolean := p_metodo in ('tarjeta', 'transferencia');
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and rol = 'paciente') then
    raise exception 'solo_pacientes';
  end if;
  -- p_lat, p_lng y p_direccion se ignoran: manda la ubicacion guardada en el perfil.
  select lat, lng, direccion into v_lat, v_lng, v_dir
  from public.profiles where id = auth.uid() and direccion <> '' and lat is not null and lng is not null;
  if v_lat is null then
    raise exception 'sin_ubicacion';
  end if;
  if exists (select 1 from public.servicios where paciente_id = auth.uid() and estado in ('solicitado', 'aceptado', 'en_camino', 'en_atencion')) then
    raise exception 'servicio_en_curso';
  end if;
  if not p_inmediato and (p_fecha is null or p_fecha < now()) then
    raise exception 'fecha_invalida';
  end if;
  select c.base, c.total into v_base, v_total from public.cotizar(p_servicio, p_inmediato, v_lat, v_lng, p_enfermero) c;

  begin
    insert into public.servicios (paciente_id, servicio_id, lat, lng, direccion, inmediato, fecha_hora,
                                  notas, total, metodo_pago, oferta_inicio, pagado, preferido, tarifa)
    values (auth.uid(), p_servicio, v_lat, v_lng, left(v_dir, 200), p_inmediato,
            case when p_inmediato then null else p_fecha end,
            left(p_notas, 500), v_total, p_metodo, now(), not v_cobra_wompi, p_enfermero, v_base)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'servicio_en_curso';
  end;

  if v_cobra_wompi then
    insert into public.pagos (servicio_id, referencia, monto_centavos)
    values (v_id, 'EY-' || replace(v_id::text, '-', ''), v_total * 100);
  else
    perform public.despachar_seguro();
  end if;
  return v_id;
end $$;

-- Despacho: primero el profesional elegido; si no responde, el mas cercano cuya tarifa no supere la pagada.
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
    select d.usuario_id into v_nurse
    from public.nurse_details d join public.profiles p on p.id = d.usuario_id
    where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado' and p.lat is not null
      and public.km_entre(p.lat, p.lng, s.lat, s.lng) <= 10
      and not (d.usuario_id = any (s.rechazados))
      and public.tarifa_de(d.usuario_id, s.servicio_id) <= coalesce(s.tarifa, 2147483647)
      and not exists (select 1 from public.servicios x where x.enfermero_id = d.usuario_id and x.estado in ('aceptado','en_camino','en_atencion'))
      and not exists (select 1 from public.servicios x where x.candidato = d.usuario_id and x.estado = 'solicitado')
    order by (d.usuario_id is not distinct from s.preferido) desc, public.km_entre(p.lat, p.lng, s.lat, s.lng)
    limit 1;

    if v_nurse is null then
      if not exists (select 1 from public.nurse_details d where public.nurse_activa(d.online, d.visto) and d.aprobado = 'aprobado'
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
  end loop;
  return v_count;
end $function$;

revoke execute on function public.tarifa_de(uuid, text), public.set_tarifa(text, integer),
  public.cotizar(text, boolean, double precision, double precision, uuid),
  public.solicitar_servicio(text, boolean, timestamptz, text, text, double precision, double precision, text, uuid)
  from public, anon;
grant execute on function public.set_tarifa(text, integer),
  public.cotizar(text, boolean, double precision, double precision, uuid),
  public.solicitar_servicio(text, boolean, timestamptz, text, text, double precision, double precision, text, uuid)
  to authenticated;
