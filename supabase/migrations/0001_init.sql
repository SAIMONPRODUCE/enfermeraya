-- EnfermeraYa · Fase 5a (auth + datos + dinero)
-- SIN VERIFICAR: escrita sin Postgres disponible. Probar antes de usar con datos reales.
--
-- Principios:
--  * El cliente nunca escribe servicios, dinero ni ganancias directamente: solo llama funciones RPC.
--  * Las funciones security definer validan auth.uid() y el rol antes de cambiar nada.
--  * Un profesional solo puede tener un servicio activo y una oferta pendiente (índices parciales únicos).

create extension if not exists pgcrypto;

-- ---------- Tablas ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol text not null check (rol in ('paciente', 'enfermero', 'admin')),
  nombre text not null check (length(nombre) between 3 and 80),
  telefono text not null check (length(telefono) between 7 and 20),
  direccion text not null default '',
  lat double precision,
  lng double precision,
  calificacion numeric(2, 1) not null default 5 check (calificacion between 1 and 5),
  color text not null default '#1d6fe8',
  created_at timestamptz not null default now()
);

create table public.nurse_details (
  usuario_id uuid primary key references public.profiles(id) on delete cascade,
  especialidad text not null,
  documentos text[] not null default '{}',          -- rutas en el bucket privado 'documentos'
  aprobado text not null default 'pendiente' check (aprobado in ('pendiente', 'aprobado', 'rechazado')),
  ganancias integer not null default 0 check (ganancias >= 0),
  online boolean not null default false,
  servicios integer not null default 0 check (servicios >= 0),
  experiencia integer not null default 0 check (experiencia >= 0),
  bio text not null default ''
);

create table public.catalogo (
  id text primary key,
  nombre text not null,
  precio_base integer not null check (precio_base > 0),
  descripcion text not null,
  icon text not null,
  duracion text not null
);

create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.profiles(id),
  enfermero_id uuid references public.profiles(id),
  candidato uuid references public.profiles(id),
  servicio_id text not null references public.catalogo(id),
  estado text not null default 'solicitado'
    check (estado in ('solicitado', 'aceptado', 'en_camino', 'en_atencion', 'completado', 'cancelado', 'sin_cobertura')),
  lat double precision not null,
  lng double precision not null,
  direccion text not null,
  inmediato boolean not null,
  fecha_hora timestamptz,
  notas text not null default '' check (length(notas) <= 500),
  total integer not null check (total > 0),
  metodo_pago text not null check (metodo_pago in ('tarjeta', 'efectivo', 'transferencia')),
  calificacion smallint check (calificacion between 1 and 5),
  resena text not null default '' check (length(resena) <= 1000),
  llego boolean not null default false,
  rechazados uuid[] not null default '{}',
  oferta_inicio timestamptz,
  creado timestamptz not null default now(),
  estado_ts timestamptz not null default now()
);

-- Un profesional: como máximo una oferta pendiente y un servicio activo a la vez.
create unique index one_pending_offer on public.servicios (candidato)
  where estado = 'solicitado' and candidato is not null;
create unique index one_active_service on public.servicios (enfermero_id)
  where estado in ('aceptado', 'en_camino', 'en_atencion');

create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  titulo text not null,
  cuerpo text not null,
  tipo text not null default 'info' check (tipo in ('info', 'exito', 'alerta')),
  leida boolean not null default false,
  creado timestamptz not null default now()
);

-- ---------- Helpers ----------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin')
$$;

create or replace function public.km_entre(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2) +
    cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2)
  ))
$$;

-- Cotización calculada en servidor. Mismas reglas que quote() en sim.ts.
create or replace function public.cotizar(p_servicio text, p_inmediato boolean, p_lat double precision, p_lng double precision)
returns table(base integer, recargo integer, desplazamiento integer, total integer)
language plpgsql stable security definer set search_path = public as $$
declare
  v_base integer;
  v_cercana double precision;
begin
  select precio_base into v_base from public.catalogo where id = p_servicio;
  if v_base is null then raise exception 'servicio_desconocido'; end if;

  select min(public.km_entre(p.lat, p.lng, p_lat, p_lng)) into v_cercana
  from public.nurse_details d join public.profiles p on p.id = d.usuario_id
  where d.online and d.aprobado = 'aprobado' and p.lat is not null
    and public.km_entre(p.lat, p.lng, p_lat, p_lng) <= 10;

  base := v_base;
  recargo := case when p_inmediato then round((v_base * 0.2) / 500) * 500 else 0 end;
  desplazamiento := greatest(2000, round(coalesce(v_cercana, 3) * 1000 / 500) * 500)::integer;
  total := base + recargo + desplazamiento;
  return next;
end $$;

-- ---------- RPC: paciente ----------

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
  -- El total NO viene del cliente: se recalcula aquí.
  select c.total into v_total from public.cotizar(p_servicio, p_inmediato, p_lat, p_lng) c;

  insert into public.servicios (paciente_id, servicio_id, lat, lng, direccion, inmediato, fecha_hora,
                                notas, total, metodo_pago, oferta_inicio)
  values (auth.uid(), p_servicio, p_lat, p_lng, left(p_direccion, 200), p_inmediato,
          case when p_inmediato then null else p_fecha end,
          left(p_notas, 500), v_total, p_metodo, now())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancelar_servicio(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.servicios set estado = 'cancelado', estado_ts = now(), candidato = null
  where id = p_id and paciente_id = auth.uid() and estado in ('solicitado', 'aceptado');
  if not found then raise exception 'no_cancelable'; end if;
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select enfermero_id, 'Servicio cancelado', 'El paciente canceló la solicitud.', 'alerta'
  from public.servicios where id = p_id and enfermero_id is not null;
end $$;

create or replace function public.calificar_servicio(p_id uuid, p_estrellas smallint, p_resena text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_nurse uuid;
  v_n integer;
  v_prev numeric;
begin
  update public.servicios set calificacion = p_estrellas, resena = left(coalesce(p_resena, ''), 1000)
  where id = p_id and paciente_id = auth.uid() and estado = 'completado' and calificacion is null
  returning enfermero_id into v_nurse;
  if not found then raise exception 'no_calificable'; end if;
  if v_nurse is null then return; end if;

  -- servicios ya incluye este servicio (se contó al completar): el promedio previo es sobre n-1
  select d.servicios - 1, p.calificacion into v_n, v_prev
  from public.nurse_details d join public.profiles p on p.id = d.usuario_id
  where d.usuario_id = v_nurse;
  update public.profiles
  set calificacion = round((v_prev * v_n + p_estrellas) / (v_n + 1), 1)
  where id = v_nurse;
end $$;

-- ---------- RPC: profesional ----------

create or replace function public.set_online(p_online boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.nurse_details set online = p_online
  where usuario_id = auth.uid() and aprobado = 'aprobado';
  if not found then raise exception 'no_aprobado'; end if;
end $$;

create or replace function public.set_ubicacion(p_lat double precision, p_lng double precision) returns void
language sql security definer set search_path = public as $$
  update public.profiles set lat = p_lat, lng = p_lng where id = auth.uid();
$$;

-- Ofertas visibles al candidato: ubicación aproximada (~1 km) hasta aceptar.
create or replace function public.mis_ofertas()
returns table(id uuid, servicio_id text, lat_aprox double precision, lng_aprox double precision,
              inmediato boolean, total_neto integer, oferta_inicio timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.servicio_id, round(s.lat::numeric, 2)::double precision, round(s.lng::numeric, 2)::double precision,
         s.inmediato, round(s.total * 0.85)::integer, s.oferta_inicio
  from public.servicios s
  where s.candidato = auth.uid() and s.estado = 'solicitado'
$$;

create or replace function public.aceptar_oferta(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pac uuid;
begin
  if not exists (select 1 from public.nurse_details where usuario_id = auth.uid() and aprobado = 'aprobado' and online) then
    raise exception 'no_disponible';
  end if;
  update public.servicios
  set enfermero_id = auth.uid(), estado = 'aceptado', estado_ts = now()
  where id = p_id and candidato = auth.uid() and estado = 'solicitado'
  returning paciente_id into v_pac;
  if not found then raise exception 'oferta_no_valida'; end if;
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  values (v_pac, '¡Enfermero asignado!', 'Tu solicitud fue aceptada.', 'exito');
end $$;

create or replace function public.rechazar_oferta(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.servicios
  set rechazados = array_append(rechazados, auth.uid()), candidato = null, oferta_inicio = null
  where id = p_id and candidato = auth.uid() and estado = 'solicitado';
$$;

-- Avance del profesional asignado. Al completar, la ganancia se suma aquí (no en el cliente).
create or replace function public.avanzar_servicio(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios%rowtype;
begin
  select * into s from public.servicios where id = p_id and enfermero_id = auth.uid() for update;
  if not found then raise exception 'no_asignado'; end if;

  if s.estado = 'aceptado' then
    update public.servicios set estado = 'en_camino', estado_ts = now() where id = p_id;
    return 'en_camino';
  elsif s.estado = 'en_camino' and not s.llego then
    update public.servicios set llego = true where id = p_id;
    return 'llego';
  elsif s.estado = 'en_camino' then
    update public.servicios set estado = 'en_atencion', estado_ts = now() where id = p_id;
    return 'en_atencion';
  elsif s.estado = 'en_atencion' then
    update public.servicios set estado = 'completado', estado_ts = now() where id = p_id;
    update public.nurse_details
    set ganancias = ganancias + round(s.total * 0.85)::integer, servicios = servicios + 1
    where usuario_id = auth.uid();
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
    values (s.paciente_id, 'Servicio completado', 'Cuéntanos cómo te fue y califica la atención.', 'exito');
    return 'completado';
  end if;
  raise exception 'transicion_invalida';
end $$;

-- ---------- RPC: admin ----------

create or replace function public.aprobar_enfermero(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo_admin'; end if;
  update public.nurse_details set aprobado = case when p_ok then 'aprobado' else 'rechazado' end, online = false
  where usuario_id = p_id;
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  values (p_id,
          case when p_ok then '¡Perfil aprobado!' else 'Documentación rechazada' end,
          case when p_ok then 'Ya puedes conectarte y recibir servicios.' else 'Revisa tus documentos y vuelve a enviarlos.' end,
          case when p_ok then 'exito' else 'alerta' end);
end $$;

-- Asignación de ofertas. Llamar periódicamente (pg_cron o Edge Function). Expira ofertas de >20 s.
create or replace function public.despachar_pendientes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios%rowtype;
  v_nurse uuid;
  v_count integer := 0;
begin
  -- 1) Ofertas vencidas: pasan a la siguiente enfermera
  update public.servicios
  set rechazados = array_append(rechazados, candidato), candidato = null, oferta_inicio = null
  where estado = 'solicitado' and candidato is not null and oferta_inicio < now() - interval '20 seconds';

  -- 2) Solicitudes sin candidato: la enfermera libre más cercana que no la haya rechazado
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
      -- sin cobertura solo si no quedan enfermeras en línea que aún no la rechazaron
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

-- ---------- RLS ----------

alter table public.profiles enable row level security;
alter table public.nurse_details enable row level security;
alter table public.catalogo enable row level security;
alter table public.servicios enable row level security;
alter table public.notificaciones enable row level security;

-- Perfil: el propio, o admin. Nombre/calificación de terceros salen por funciones, no por esta tabla.
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert with check (id = auth.uid() and rol in ('paciente', 'enfermero'));
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- Columnas editables por el cliente: rol, calificación y posición NO (rol/calificación/posición por funciones).
revoke update on public.profiles from authenticated;
grant update (nombre, telefono, direccion, color) on public.profiles to authenticated;

create policy nurse_select on public.nurse_details for select using (usuario_id = auth.uid() or public.is_admin());
create policy nurse_insert on public.nurse_details for insert with check (usuario_id = auth.uid() and aprobado = 'pendiente' and ganancias = 0 and servicios = 0 and online = false);
-- Sin UPDATE directo: online/ganancias/aprobado solo cambian por funciones.

create policy catalogo_select on public.catalogo for select using (true);

-- Servicio: visible a paciente, a la enfermera asignada y al admin. La oferta NO es visible en esta tabla.
create policy servicios_select on public.servicios for select
  using (paciente_id = auth.uid() or enfermero_id = auth.uid() or public.is_admin());

create policy notif_select on public.notificaciones for select using (user_id = auth.uid());
create policy notif_update on public.notificaciones for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Grants de funciones ----------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.cotizar(text, boolean, double precision, double precision),
  public.solicitar_servicio(text, boolean, timestamptz, text, text, double precision, double precision, text),
  public.cancelar_servicio(uuid),
  public.calificar_servicio(uuid, smallint, text),
  public.set_online(boolean),
  public.set_ubicacion(double precision, double precision),
  public.mis_ofertas(),
  public.aceptar_oferta(uuid),
  public.rechazar_oferta(uuid),
  public.avanzar_servicio(uuid),
  public.aprobar_enfermero(uuid, boolean)
  to authenticated;
-- despachar_pendientes() y is_admin() no se exponen al cliente: solo cron / funciones internas.

-- ---------- Datos iniciales ----------

insert into public.catalogo (id, nombre, precio_base, descripcion, icon, duracion) values
  ('inyect', 'Inyectología', 35000, 'Aplicación de inyecciones IM, IV o subcutáneas con fórmula médica.', 'syringe', '20 min'),
  ('cura', 'Curaciones', 55000, 'Curación de heridas, retiro de puntos y manejo de apósitos.', 'bandage', '30 min'),
  ('posop', 'Postoperatorio', 90000, 'Cuidado y vigilancia tras una cirugía, control de signos y medicación.', 'heart', '1 h'),
  ('adulto', 'Adulto mayor', 120000, 'Acompañamiento profesional, higiene, movilidad y medicación.', 'users', '2 h'),
  ('muestras', 'Toma de muestras', 45000, 'Toma de sangre y otras muestras en casa, con envío al laboratorio.', 'flask', '20 min'),
  ('suero', 'Terapia IV', 110000, 'Sueroterapia y administración de medicamentos endovenosos.', 'droplet', '1 h')
on conflict (id) do nothing;

-- ---------- Bucket privado para documentos (tarjeta profesional, diploma) ----------

insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- El profesional sube solo dentro de su carpeta <uid>/ ; el admin lee todo. Nadie más.
create policy documentos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy documentos_read on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
