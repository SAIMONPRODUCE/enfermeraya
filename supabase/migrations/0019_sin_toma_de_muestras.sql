-- 0019: servicios desactivables. Toma de muestras sale del catalogo: no hay laboratorio aliado.
-- La fila se conserva (servicios viejos la referencian); no se cotiza, no se pide y no se le fija tarifa.

alter table public.catalogo add column activo boolean not null default true;
update public.catalogo set activo = false where id = 'muestras';

create or replace function public.set_tarifa(p_servicio text, p_precio integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.nurse_details where usuario_id = auth.uid()) then
    raise exception 'solo_profesionales';
  end if;
  if not exists (select 1 from public.catalogo where id = p_servicio and activo and p_precio between precio_min and precio_max) then
    raise exception 'tarifa_fuera_de_rango';
  end if;
  insert into public.tarifas (enfermero_id, servicio_id, precio) values (auth.uid(), p_servicio, p_precio)
  on conflict (enfermero_id, servicio_id) do update set precio = excluded.precio, actualizado = now();
end $$;

-- cotizar tambien la usa solicitar_servicio: un servicio inactivo no se puede pedir.
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
