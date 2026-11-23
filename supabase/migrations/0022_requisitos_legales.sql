-- 0022: requisitos legales minimos (modo A, solo plataforma).
-- * Solo enfermeros profesionales: cedula (para verificar ReTHUS) y codigo REPS de prestador independiente; sin ellos no se aprueba.
-- * Aceptacion de terminos y autorizacion de datos (salud y ubicacion) con version y fecha; obligatoria al registrarse.
-- * Orden medica obligatoria en inyectologia y terapia IV, guardada en un bucket privado.

-- ---------- Registros del profesional ----------
alter table public.nurse_details
  add column documento text not null default '' check (documento = '' or documento ~ '^[0-9]{5,12}$'),
  add column reps text not null default '' check (reps = '' or reps ~ '^[0-9]{6,15}$');

-- ---------- Terminos aceptados ----------
alter table public.profiles
  add column terminos_version text not null default '',
  add column terminos_ts timestamptz;

create or replace function public.terminos_vigentes() returns text language sql immutable as $$ select 'v1-2026-11' $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_rol text := m->>'rol';
  v_nurse boolean := v_rol = 'enfermero';
  v_doc text := regexp_replace(coalesce(m->>'documento', ''), '\D', '', 'g');
  v_reps text := regexp_replace(coalesce(m->>'reps', ''), '\D', '', 'g');
begin
  if v_rol is null or v_rol not in ('paciente', 'enfermero') then return new; end if;
  -- Sin aceptar los terminos vigentes no se crea la cuenta.
  if coalesce(m->>'terminos', '') <> public.terminos_vigentes() then raise exception 'terminos_requeridos'; end if;
  if v_nurse and (v_doc !~ '^[0-9]{5,12}$' or v_reps !~ '^[0-9]{6,15}$') then raise exception 'registros_invalidos'; end if;
  insert into public.profiles (id, rol, nombre, telefono, direccion, lat, lng, color, terminos_version, terminos_ts)
  values (new.id, v_rol, trim(m->>'nombre'), trim(m->>'telefono'), '',
          case when v_nurse then 4.7143 + (random() - 0.5) * 0.02 end,
          case when v_nurse then -74.0645 + (random() - 0.5) * 0.02 end,
          case when v_nurse then '#0ea5a4' else '#1d6fe8' end,
          public.terminos_vigentes(), now());
  if v_nurse then
    insert into public.nurse_details (usuario_id, especialidad, bio, documento, reps)
    values (new.id, left(coalesce(nullif(trim(m->>'especialidad'), ''), 'Enfermera/o profesional'), 80),
            'Nuevo profesional en EnfermeraYa.', v_doc, v_reps);
  end if;
  return new;
end $$;

-- Usuarios existentes (o nueva version de terminos): aceptan desde la app.
create or replace function public.aceptar_terminos(p_version text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_version is distinct from public.terminos_vigentes() then raise exception 'terminos_desactualizados'; end if;
  update public.profiles set terminos_version = p_version, terminos_ts = now() where id = auth.uid();
end $$;

-- Profesional pendiente o rechazado (o aprobado antes de este requisito) completa cedula y REPS.
create or replace function public.set_registros(p_documento text, p_reps text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_doc text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_reps text := regexp_replace(coalesce(p_reps, ''), '\D', '', 'g');
begin
  if v_doc !~ '^[0-9]{5,12}$' or v_reps !~ '^[0-9]{6,15}$' then raise exception 'registros_invalidos'; end if;
  update public.nurse_details set documento = v_doc, reps = v_reps
  where usuario_id = auth.uid() and (aprobado <> 'aprobado' or documento = '' or reps = '');
  if not found then raise exception 'no_editable'; end if;
end $$;

create or replace function public.aprobar_enfermero(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo_admin'; end if;
  -- Modo A: solo enfermeros profesionales con cedula (para verificar ReTHUS) y codigo REPS de prestador independiente.
  if p_ok and exists (select 1 from public.nurse_details where usuario_id = p_id and (documento = '' or reps = '')) then
    raise exception 'faltan_registros';
  end if;
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

-- ---------- Orden medica ----------
alter table public.catalogo add column requiere_orden boolean not null default false;
update public.catalogo set requiere_orden = true where id in ('inyect', 'suero');
alter table public.servicios add column orden text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ordenes', 'ordenes', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy ordenes_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ordenes' and (storage.foldername(name))[1] = auth.uid()::text);
-- La lee el paciente dueno, el admin y el profesional asignado al servicio que la usa.
create policy ordenes_read on storage.objects for select to authenticated
  using (bucket_id = 'ordenes' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.servicios s where s.orden = name and s.enfermero_id = auth.uid())));

drop function public.solicitar_servicio(text, boolean, timestamptz, text, text, double precision, double precision, text, uuid);
create function public.solicitar_servicio(
  p_servicio text, p_inmediato boolean, p_fecha timestamptz, p_notas text,
  p_metodo text, p_lat double precision, p_lng double precision, p_direccion text, p_enfermero uuid default null,
  p_orden text default ''
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
  -- Inyectologia y terapia IV exigen orden medica: archivo propio ya subido al bucket privado 'ordenes'.
  if (select requiere_orden from public.catalogo where id = p_servicio) and (
       coalesce(p_orden, '') !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'ordenes' and o.name = p_orden)) then
    raise exception 'orden_requerida';
  end if;
  select c.base, c.total into v_base, v_total from public.cotizar(p_servicio, p_inmediato, v_lat, v_lng, p_enfermero) c;

  begin
    insert into public.servicios (paciente_id, servicio_id, lat, lng, direccion, inmediato, fecha_hora,
                                  notas, total, metodo_pago, oferta_inicio, pagado, preferido, tarifa, orden)
    values (auth.uid(), p_servicio, v_lat, v_lng, left(v_dir, 200), p_inmediato,
            case when p_inmediato then null else p_fecha end,
            left(p_notas, 500), v_total, p_metodo, now(), not v_cobra_wompi, p_enfermero, v_base,
            case when (select requiere_orden from public.catalogo where id = p_servicio) then p_orden else '' end)
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

revoke execute on function public.terminos_vigentes(), public.aceptar_terminos(text), public.set_registros(text, text),
  public.solicitar_servicio(text, boolean, timestamptz, text, text, double precision, double precision, text, uuid, text) from public, anon;
grant execute on function public.aceptar_terminos(text), public.set_registros(text, text),
  public.solicitar_servicio(text, boolean, timestamptz, text, text, double precision, double precision, text, uuid, text) to authenticated;
