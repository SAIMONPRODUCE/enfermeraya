-- Prueba de presencia (0015): un profesional sin latido en 2 minutos no recibe ofertas, no aparece cerca,
-- no puede aceptar, y vuelve a estar activo con latido(). Termina en RAISE EXCEPTION para revertir.
-- Correr: supabase db query --linked -f supabase/tests/presencia_test.sql
do $$
declare
  pac uuid := gen_random_uuid();
  enf uuid := gen_random_uuid();
  s1 uuid; s2 uuid; s3 uuid;
  r record;
  msg text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (pac, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pre-pac@example.invalid',
          '{"rol":"paciente","nombre":"Pac Presencia","telefono":"+573000000041"}'::jsonb),
         (enf, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pre-enf@example.invalid',
          '{"rol":"enfermero","nombre":"Enf Presencia","telefono":"+573000000042","especialidad":"Inyectologia"}'::jsonb);
  update public.profiles set direccion = 'Calle 1', lat = 4.60, lng = -74.20 where id = pac;
  update public.profiles set lat = 4.60, lng = -74.20 where id = enf;
  update public.nurse_details set aprobado = 'aprobado', online = true where usuario_id = enf;
  update public.nurse_details set online = false where usuario_id <> enf; -- solo la de la prueba

  -- 1) activo (latido reciente): recibe la oferta y aparece cerca
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.enfermeras_cerca(0, 0, 10) where id = enf) then raise exception 'FAIL 1: no aparece cerca'; end if;
  s1 := public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x');
  if (select candidato from public.servicios where id = s1) is distinct from enf then raise exception 'FAIL 1: no recibio la oferta con latido reciente'; end if;

  -- 2) sin latido por 3 minutos: no puede aceptar la oferta que tenia
  update public.nurse_details set visto = now() - interval '3 minutes' where usuario_id = enf;
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  begin
    perform public.aceptar_oferta(s1);
    raise exception 'FAIL 2: acepto sin latido';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg <> 'no_disponible' then raise exception 'FAIL 2: mensaje %', msg; end if;
  end;

  -- 3) sin latido: no aparece cerca y un pedido nuevo queda sin cobertura (no se manda a una sesion muerta)
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  perform public.cancelar_servicio(s1);
  if exists (select 1 from public.enfermeras_cerca(0, 0, 10) where id = enf) then raise exception 'FAIL 3: aparece cerca sin latido'; end if;
  s2 := public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x');
  select estado, candidato into r from public.servicios where id = s2;
  if r.estado <> 'sin_cobertura' or r.candidato is not null then raise exception 'FAIL 3: %', r; end if;

  -- 4) latido() lo reactiva
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  perform public.latido();
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.enfermeras_cerca(0, 0, 10) where id = enf) then raise exception 'FAIL 4: latido no lo reactivo'; end if;
  s3 := public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x');
  if (select candidato from public.servicios where id = s3) is distinct from enf then raise exception 'FAIL 4: no recibio oferta tras latido'; end if;

  -- 5) latido() no activa a quien esta desconectado
  update public.nurse_details set online = false, visto = now() - interval '1 hour' where usuario_id = enf;
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  perform public.latido();
  if (select visto from public.nurse_details where usuario_id = enf) > now() - interval '30 minutes' then raise exception 'FAIL 5: latido actualizo a un desconectado'; end if;

  raise exception 'ALL PRESENCIA TESTS PASSED (rollback)';
end $$;
