-- 0011: el paciente nuevo no tiene ubicacion de demo; debe elegirla antes de pedir un servicio.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_rol text := m->>'rol';
  v_nurse boolean := v_rol = 'enfermero';
begin
  if v_rol is null or v_rol not in ('paciente', 'enfermero') then return new; end if;
  -- Paciente: sin direccion ni coordenadas hasta que la elija. Enfermero: punto inicial en Chapinero hasta que su GPS reporte.
  -- ponytail: ubicacion inicial del enfermero fija (demo); la reemplaza set_ubicacion con el GPS del dispositivo.
  insert into public.profiles (id, rol, nombre, telefono, direccion, lat, lng, color)
  values (new.id, v_rol, trim(m->>'nombre'), trim(m->>'telefono'), '',
          case when v_nurse then 4.7143 + (random() - 0.5) * 0.02 end,
          case when v_nurse then -74.0645 + (random() - 0.5) * 0.02 end,
          case when v_nurse then '#0ea5a4' else '#1d6fe8' end);
  if v_nurse then
    insert into public.nurse_details (usuario_id, especialidad, bio)
    values (new.id, coalesce(nullif(trim(m->>'especialidad'), ''), 'Enfermera/o profesional'),
            'Nuevo profesional en EnfermeraYa.');
  end if;
  return new;
end $$;

create or replace function public.solicitar_servicio(
  p_servicio text, p_inmediato boolean, p_fecha timestamptz, p_notas text,
  p_metodo text, p_lat double precision, p_lng double precision, p_direccion text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_total integer;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and rol = 'paciente') then
    raise exception 'solo_pacientes';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and direccion <> '' and lat is not null and lng is not null) then
    raise exception 'sin_ubicacion';
  end if;
  if not p_inmediato and (p_fecha is null or p_fecha < now()) then
    raise exception 'fecha_invalida';
  end if;
  select c.total into v_total from public.cotizar(p_servicio, p_inmediato, p_lat, p_lng) c;

  insert into public.servicios (paciente_id, servicio_id, lat, lng, direccion, inmediato, fecha_hora,
                                notas, total, metodo_pago, oferta_inicio, pagado)
  values (auth.uid(), p_servicio, p_lat, p_lng, left(p_direccion, 200), p_inmediato,
          case when p_inmediato then null else p_fecha end,
          left(p_notas, 500), v_total, p_metodo, now(), p_metodo <> 'tarjeta')
  returning id into v_id;

  if p_metodo = 'tarjeta' then
    insert into public.pagos (servicio_id, referencia, monto_centavos)
    values (v_id, 'EY-' || replace(v_id::text, '-', ''), v_total * 100);
  else
    perform public.despachar_seguro();
  end if;
  return v_id;
end $$;
