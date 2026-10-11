-- 0005: textos con acentos corruptos en 0001 (se pego por portapapeles: UTF-8 leido como MacRoman,
-- p.ej. '\u00a1' quedo como '\u00ac\u00b0'). Se recrean las funciones afectadas con E'\u00..' y se corrigen filas ya guardadas.
-- Solo ASCII en este archivo.

create or replace function public.cancelar_servicio(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.servicios set estado = 'cancelado', estado_ts = now(), candidato = null
  where id = p_id and paciente_id = auth.uid() and estado in ('solicitado', 'aceptado');
  if not found then raise exception 'no_cancelable'; end if;
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select enfermero_id, 'Servicio cancelado', E'El paciente cancel\u00f3 la solicitud.', 'alerta'
  from public.servicios where id = p_id and enfermero_id is not null;
end $$;

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
  values (v_pac, E'\u00a1Enfermero asignado!', 'Tu solicitud fue aceptada.', 'exito');
end $$;

create or replace function public.aprobar_enfermero(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo_admin'; end if;
  update public.nurse_details set aprobado = case when p_ok then 'aprobado' else 'rechazado' end, online = false
  where usuario_id = p_id;
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  values (p_id,
          case when p_ok then E'\u00a1Perfil aprobado!' else E'Documentaci\u00f3n rechazada' end,
          case when p_ok then 'Ya puedes conectarte y recibir servicios.' else E'Revisa tus documentos y vuelve a enviarlos.' end,
          case when p_ok then 'exito' else 'alerta' end);
end $$;

-- Filas ya guardadas con el texto corrupto: U+00AC U+00B0 vuelve a U+00A1, U+221A U+2265 vuelve a U+00F3.
update public.notificaciones
set titulo = replace(replace(titulo, U&'\00AC\00B0', E'\u00a1'), U&'\221A\2265', E'\u00f3'),
    cuerpo = replace(replace(cuerpo, U&'\00AC\00B0', E'\u00a1'), U&'\221A\2265', E'\u00f3')
where titulo ~ '[^\x01-\x7F]' or cuerpo ~ '[^\x01-\x7F]';
