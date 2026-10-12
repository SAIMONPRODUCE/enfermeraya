-- 0012: tras auditoria. (1) transferencia (Nequi/PSE) se cobra por Wompi igual que tarjeta; solo efectivo se despacha sin pago.
-- (4) la ubicacion y la direccion del servicio salen del perfil del paciente, no de lo que mande el cliente.

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
  -- p_lat, p_lng y p_direccion se ignoran: manda la ubicacion guardada en el perfil (cotizar y despacho dependen de ella).
  select lat, lng, direccion into v_lat, v_lng, v_dir
  from public.profiles where id = auth.uid() and direccion <> '' and lat is not null and lng is not null;
  if v_lat is null then
    raise exception 'sin_ubicacion';
  end if;
  if not p_inmediato and (p_fecha is null or p_fecha < now()) then
    raise exception 'fecha_invalida';
  end if;
  select c.total into v_total from public.cotizar(p_servicio, p_inmediato, v_lat, v_lng) c;

  insert into public.servicios (paciente_id, servicio_id, lat, lng, direccion, inmediato, fecha_hora,
                                notas, total, metodo_pago, oferta_inicio, pagado)
  values (auth.uid(), p_servicio, v_lat, v_lng, left(v_dir, 200), p_inmediato,
          case when p_inmediato then null else p_fecha end,
          left(p_notas, 500), v_total, p_metodo, now(), not v_cobra_wompi)
  returning id into v_id;

  if v_cobra_wompi then
    insert into public.pagos (servicio_id, referencia, monto_centavos)
    values (v_id, 'EY-' || replace(v_id::text, '-', ''), v_total * 100);
  else
    perform public.despachar_seguro();
  end if;
  return v_id;
end $$;
