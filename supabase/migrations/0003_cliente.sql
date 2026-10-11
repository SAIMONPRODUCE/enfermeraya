-- 0003: lo que necesita el cliente para dejar la simulacion local.
-- Solo ASCII: los acentos van como E'\u00..' (el portapapeles los corrompe).

-- Funciones nuevas: nadie las ejecuta salvo que se otorgue explicitamente.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------- Registro: perfil creado por trigger ----------
-- Funciona con o sin confirmacion de correo (signUp sin sesion no puede insertar por RLS).
-- Usuarios sin rol en metadatos (dashboard, admin) no reciben perfil: se crea a mano.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_rol text := m->>'rol';
  v_nurse boolean := v_rol = 'enfermero';
begin
  if v_rol is null or v_rol not in ('paciente', 'enfermero') then return new; end if;
  -- ponytail: ubicacion inicial fija en Chapinero (demo); reemplazar por GPS del dispositivo.
  insert into public.profiles (id, rol, nombre, telefono, direccion, lat, lng, color)
  values (new.id, v_rol, trim(m->>'nombre'), trim(m->>'telefono'),
          case when v_nurse then '' else 'Cra 15 #93-40, Chapinero' end,
          4.7143 + case when v_nurse then (random() - 0.5) * 0.02 else 0 end,
          -74.0645 + case when v_nurse then (random() - 0.5) * 0.02 else 0 end,
          case when v_nurse then '#0ea5a4' else '#1d6fe8' end);
  if v_nurse then
    insert into public.nurse_details (usuario_id, especialidad, bio)
    values (new.id, coalesce(nullif(trim(m->>'especialidad'), ''), 'Enfermera/o profesional'),
            'Nuevo profesional en EnfermeraYa.');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Despacho inmediato ----------
-- Se llama al crear, rechazar o conectarse. Si dos transacciones eligen a la misma enfermera,
-- el indice one_pending_offer falla: se descarta solo el despacho y el cron reintenta.
create or replace function public.despachar_seguro() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.despachar_pendientes();
exception when unique_violation then
  null;
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
  if not p_inmediato and (p_fecha is null or p_fecha < now()) then
    raise exception 'fecha_invalida';
  end if;
  select c.total into v_total from public.cotizar(p_servicio, p_inmediato, p_lat, p_lng) c;

  insert into public.servicios (paciente_id, servicio_id, lat, lng, direccion, inmediato, fecha_hora,
                                notas, total, metodo_pago, oferta_inicio)
  values (auth.uid(), p_servicio, p_lat, p_lng, left(p_direccion, 200), p_inmediato,
          case when p_inmediato then null else p_fecha end,
          left(p_notas, 500), v_total, p_metodo, now())
  returning id into v_id;
  perform public.despachar_seguro();
  return v_id;
end $$;

create or replace function public.rechazar_oferta(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.servicios
  set rechazados = array_append(rechazados, auth.uid()), candidato = null, oferta_inicio = null
  where id = p_id and candidato = auth.uid() and estado = 'solicitado';
  perform public.despachar_seguro();
end $$;

create or replace function public.set_online(p_online boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.nurse_details set online = p_online
  where usuario_id = auth.uid() and aprobado = 'aprobado';
  if not found then raise exception 'no_aprobado'; end if;
  if p_online then perform public.despachar_seguro(); end if;
end $$;

-- ---------- Avance con notificacion al paciente en cada paso ----------
create or replace function public.avanzar_servicio(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios%rowtype;
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
    update public.servicios set estado = 'completado', estado_ts = now() where id = p_id;
    update public.nurse_details
    set ganancias = ganancias + round(s.total * 0.85)::integer, servicios = servicios + 1
    where usuario_id = auth.uid();
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
    values (s.paciente_id, 'Servicio completado', E'Cu\u00e9ntanos c\u00f3mo te fue y califica la atenci\u00f3n.', 'exito');
    return 'completado';
  end if;
  raise exception 'transicion_invalida';
end $$;

-- ---------- Lecturas para el cliente ----------

-- Ofertas: ahora con notas, fecha y total bruto (el cliente muestra el 85 %). Ubicacion sigue aproximada.
drop function public.mis_ofertas();
create function public.mis_ofertas()
returns table(id uuid, servicio_id text, lat_aprox double precision, lng_aprox double precision,
              inmediato boolean, fecha_hora timestamptz, notas text, total integer, oferta_inicio timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.servicio_id, round(s.lat::numeric, 2)::double precision, round(s.lng::numeric, 2)::double precision,
         s.inmediato, s.fecha_hora, s.notas, s.total, s.oferta_inicio
  from public.servicios s
  where s.candidato = auth.uid() and s.estado = 'solicitado'
$$;

-- Personas ligadas a mis servicios (profiles no deja ver terceros).
-- Telefono: solo de quien esta asignado. Posicion de la enfermera: solo con servicio activo.
create or replace function public.mis_contactos()
returns table(id uuid, nombre text, color text, calificacion numeric, telefono text,
              especialidad text, servicios integer, lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select distinct on (p.id)
    p.id, p.nombre, p.color, p.calificacion,
    case when coalesce(s.enfermero_id = p.id, false) or s.paciente_id = p.id then p.telefono end,
    d.especialidad, d.servicios,
    case when coalesce(s.enfermero_id = p.id, false) and s.estado in ('aceptado', 'en_camino', 'en_atencion') then p.lat end,
    case when coalesce(s.enfermero_id = p.id, false) and s.estado in ('aceptado', 'en_camino', 'en_atencion') then p.lng end
  from public.servicios s
  join public.profiles p on p.id in (s.enfermero_id, s.candidato, s.paciente_id) and p.id <> auth.uid()
  left join public.nurse_details d on d.usuario_id = p.id
  where s.paciente_id = auth.uid() or s.enfermero_id = auth.uid()
  order by p.id,
    (coalesce(s.enfermero_id = p.id, false) and s.estado in ('aceptado', 'en_camino', 'en_atencion')) desc,
    (coalesce(s.enfermero_id = p.id, false) or s.paciente_id = p.id) desc
$$;

-- Enfermeras libres cerca de un punto (mismo filtro que despachar_pendientes). Posicion redondeada a ~100 m.
create or replace function public.enfermeras_cerca(p_lat double precision, p_lng double precision, p_radio double precision default 10)
returns table(id uuid, nombre text, color text, calificacion numeric, especialidad text, servicios integer,
              lat double precision, lng double precision, km double precision)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, p.color, p.calificacion, d.especialidad, d.servicios,
         round(p.lat::numeric, 3)::double precision, round(p.lng::numeric, 3)::double precision,
         public.km_entre(p.lat, p.lng, p_lat, p_lng) as km
  from public.nurse_details d join public.profiles p on p.id = d.usuario_id
  where d.online and d.aprobado = 'aprobado' and p.lat is not null
    and public.km_entre(p.lat, p.lng, p_lat, p_lng) <= least(p_radio, 10)
    and not exists (select 1 from public.servicios x where x.enfermero_id = d.usuario_id and x.estado in ('aceptado', 'en_camino', 'en_atencion'))
    and not exists (select 1 from public.servicios x where x.candidato = d.usuario_id and x.estado = 'solicitado')
  order by km
  limit 20
$$;

-- ---------- Documentos ----------
-- El profesional registra las rutas que subio a su carpeta. Reenviar tras un rechazo vuelve a 'pendiente'.
create or replace function public.set_documentos(p_paths text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(array_length(p_paths, 1), 0) not between 1 and 5
     or exists (select 1 from unnest(p_paths) x where x not like auth.uid()::text || '/%') then
    raise exception 'ruta_invalida';
  end if;
  update public.nurse_details set documentos = p_paths, aprobado = 'pendiente', online = false
  where usuario_id = auth.uid() and aprobado in ('pendiente', 'rechazado');
  if not found then raise exception 'no_editable'; end if;
end $$;

-- ---------- Grants ----------
revoke execute on function
  public.handle_new_user(), public.despachar_seguro(), public.mis_ofertas(), public.mis_contactos(),
  public.enfermeras_cerca(double precision, double precision, double precision), public.set_documentos(text[])
  from public, anon, authenticated;
grant execute on function
  public.mis_ofertas(), public.mis_contactos(),
  public.enfermeras_cerca(double precision, double precision, double precision), public.set_documentos(text[])
  to authenticated;
