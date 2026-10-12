-- 0013: cierre de la auditoria. Un servicio activo por paciente, pago con id de Wompi unico,
-- rastreo de enfermeras limitado, rutas de documentos validadas.

-- 1) Un solo servicio activo por paciente (frena el spam de ofertas a las enfermeras).
create unique index one_active_per_patient on public.servicios (paciente_id)
  where estado in ('solicitado', 'aceptado', 'en_camino', 'en_atencion');

create or replace function public.solicitar_servicio(
  p_servicio text, p_inmediato boolean, p_fecha timestamptz, p_notas text,
  p_metodo text, p_lat double precision, p_lng double precision, p_direccion text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_total integer;
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
  select c.total into v_total from public.cotizar(p_servicio, p_inmediato, v_lat, v_lng) c;

  begin
    insert into public.servicios (paciente_id, servicio_id, lat, lng, direccion, inmediato, fecha_hora,
                                  notas, total, metodo_pago, oferta_inicio, pagado)
    values (auth.uid(), p_servicio, v_lat, v_lng, left(v_dir, 200), p_inmediato,
            case when p_inmediato then null else p_fecha end,
            left(p_notas, 500), v_total, p_metodo, now(), not v_cobra_wompi)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'servicio_en_curso'; -- dos pedidos simultaneos del mismo paciente
  end;

  if v_cobra_wompi then
    insert into public.pagos (servicio_id, referencia, monto_centavos)
    values (v_id, 'EY-' || replace(v_id::text, '-', ''), v_total * 100);
  else
    perform public.despachar_seguro();
  end if;
  return v_id;
end $$;

-- 2) Una transaccion de Wompi paga una sola referencia: id unico y deteccion de reutilizacion.
create unique index pagos_wompi_id_key on public.pagos (wompi_id) where wompi_id is not null;

create or replace function public.confirmar_pago(p_referencia text, p_estado text, p_wompi_id text, p_monto integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_servicio uuid;
  v_estado text := p_estado;
  v_wid text := p_wompi_id;
begin
  select servicio_id into v_servicio from public.pagos where referencia = p_referencia and estado = 'pendiente' for update;
  if v_servicio is null then return; end if; -- ya procesado: idempotente

  -- el mismo id de transaccion ya pago otra referencia: no se despacha
  if v_wid is not null and exists (select 1 from public.pagos where wompi_id = v_wid and referencia <> p_referencia) then
    v_estado := 'error';
    v_wid := null;
  end if;
  -- un APPROVED con monto distinto no despacha el servicio
  if v_estado = 'aprobado' and p_monto is distinct from (select monto_centavos from public.pagos where referencia = p_referencia) then
    v_estado := 'error';
  end if;
  update public.pagos set estado = v_estado, wompi_id = v_wid where referencia = p_referencia;

  if v_estado = 'aprobado' then
    update public.servicios set pagado = true where id = v_servicio;
    perform public.despachar_seguro();
  else
    update public.servicios set estado = 'cancelado', estado_ts = now() where id = v_servicio and not pagado;
  end if;
end $$;

-- 3) enfermeras_cerca: parte siempre de la ubicacion guardada del paciente (no de coordenadas del cliente),
--    redondea posiciones a ~1 km y distancias a 0,1 km. Sin esto, tres consultas con coordenadas elegidas
--    permitian ubicar con exactitud a una enfermera en linea.
create or replace function public.enfermeras_cerca(p_lat double precision, p_lng double precision, p_radio double precision default 10)
returns table(id uuid, nombre text, color text, calificacion numeric, especialidad text, servicios integer, lat double precision, lng double precision, km double precision)
language sql stable security definer set search_path = public as $$
  with yo as (
    select pr.lat, pr.lng from public.profiles pr where pr.id = auth.uid() and pr.rol = 'paciente' and pr.lat is not null and pr.lng is not null
  )
  select p.id, p.nombre, p.color, p.calificacion, d.especialidad, d.servicios,
         round(p.lat::numeric, 2)::double precision, round(p.lng::numeric, 2)::double precision,
         round(public.km_entre(p.lat, p.lng, yo.lat, yo.lng)::numeric, 1)::double precision as km
  from yo
  cross join public.nurse_details d
  join public.profiles p on p.id = d.usuario_id
  where d.online and d.aprobado = 'aprobado' and p.lat is not null
    and public.km_entre(p.lat, p.lng, yo.lat, yo.lng) <= least(p_radio, 10)
    and not exists (select 1 from public.servicios x where x.enfermero_id = d.usuario_id and x.estado in ('aceptado', 'en_camino', 'en_atencion'))
    and not exists (select 1 from public.servicios x where x.candidato = d.usuario_id and x.estado = 'solicitado')
  order by public.km_entre(p.lat, p.lng, yo.lat, yo.lng)
  limit 20
$$;

-- 4) set_documentos: ruta exacta <uid>/<archivo> (sin subcarpetas ni ..) y el archivo debe existir en el bucket.
create or replace function public.set_documentos(p_paths text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(array_length(p_paths, 1), 0) not between 1 and 5
     or exists (
       select 1 from unnest(p_paths) x
       where x !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
          or not exists (select 1 from storage.objects o where o.bucket_id = 'documentos' and o.name = x)
     ) then
    raise exception 'ruta_invalida';
  end if;
  update public.nurse_details set documentos = p_paths, aprobado = 'pendiente', online = false
  where usuario_id = auth.uid() and aprobado in ('pendiente', 'rechazado');
  if not found then raise exception 'no_editable'; end if;
end $$;
