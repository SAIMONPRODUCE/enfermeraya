-- Prueba de requisitos legales (0022). Termina en RAISE EXCEPTION para revertir.
-- Correr: supabase db query --linked -f supabase/tests/legales_test.sql
do $$
declare
  pac uuid := gen_random_uuid();
  enf uuid := gen_random_uuid();
  sin uuid := gen_random_uuid();
  adm uuid := gen_random_uuid();
  s1 uuid;
  msg text;
begin
  -- 1) sin aceptar terminos no hay registro; enfermero sin cedula/REPS tampoco
  begin
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
      (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'le-x@example.invalid', '{"rol":"paciente","nombre":"Sin Terminos","telefono":"+573000000091"}'::jsonb);
    raise exception 'FAIL 1a';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'terminos_requeridos' then raise exception 'FAIL 1a: %', msg; end if; end;
  begin
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
      (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'le-y@example.invalid', '{"terminos":"v1-2026-11","rol":"enfermero","nombre":"Sin Reps","telefono":"+573000000092","documento":"123"}'::jsonb);
    raise exception 'FAIL 1b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'registros_invalidos' then raise exception 'FAIL 1b: %', msg; end if; end;

  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
    (pac, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'le-pac@example.invalid', '{"terminos":"v1-2026-11","rol":"paciente","nombre":"Pac Legal","telefono":"+573000000093"}'::jsonb),
    (enf, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'le-enf@example.invalid', '{"terminos":"v1-2026-11","rol":"enfermero","nombre":"Enf Legal","telefono":"+573000000094","documento":"1.012.345.678","reps":"110010000009"}'::jsonb),
    (adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'le-adm@example.invalid', '{"terminos":"v1-2026-11","rol":"paciente","nombre":"Adm Legal","telefono":"+573000000095"}'::jsonb);
  update public.profiles set rol = 'admin' where id = adm;
  if (select terminos_version from public.profiles where id = pac) <> 'v1-2026-11' or (select terminos_ts from public.profiles where id = pac) is null then raise exception 'FAIL 1c'; end if;
  if (select documento || '|' || reps from public.nurse_details where usuario_id = enf) <> '1012345678|110010000009' then raise exception 'FAIL 1d'; end if;

  -- 2) no se aprueba sin cedula y REPS
  update public.nurse_details set reps = '' where usuario_id = enf;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin perform public.aprobar_enfermero(enf, true); raise exception 'FAIL 2';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'faltan_registros' then raise exception 'FAIL 2: %', msg; end if; end;
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  perform public.set_registros('1012345678', '110010000009');
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.aprobar_enfermero(enf, true);
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  begin perform public.set_registros('999999', '999999'); raise exception 'FAIL 2b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'no_editable' then raise exception 'FAIL 2b: %', msg; end if; end;

  -- 3) aceptar terminos: solo la version vigente
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  begin perform public.aceptar_terminos('v0'); raise exception 'FAIL 3';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'terminos_desactualizados' then raise exception 'FAIL 3: %', msg; end if; end;
  perform public.aceptar_terminos('v1-2026-11');

  -- 4) orden medica: obligatoria en inyectologia, propia y existente; no en curaciones
  update public.profiles set direccion = 'Calle 1', lat = 4.60, lng = -74.20 where id = pac;
  update public.profiles set lat = 4.601, lng = -74.20 where id = enf;
  update public.nurse_details set online = false where usuario_id <> enf;
  update public.nurse_details set online = true, visto = now() where usuario_id = enf;
  begin perform public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x'); raise exception 'FAIL 4a';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'orden_requerida' then raise exception 'FAIL 4a: %', msg; end if; end;
  begin perform public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x', null, pac::text || '/no-existe.pdf'); raise exception 'FAIL 4b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'orden_requerida' then raise exception 'FAIL 4b: %', msg; end if; end;
  insert into storage.objects (bucket_id, name) values ('ordenes', enf::text || '/ajena.pdf'), ('ordenes', pac::text || '/1-orden.pdf');
  begin perform public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x', null, enf::text || '/ajena.pdf'); raise exception 'FAIL 4c';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'orden_requerida' then raise exception 'FAIL 4c: %', msg; end if; end;
  s1 := public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x', null, pac::text || '/1-orden.pdf');
  if (select orden from public.servicios where id = s1) <> pac::text || '/1-orden.pdf' then raise exception 'FAIL 4d'; end if;
  perform public.cancelar_servicio(s1);
  s1 := public.solicitar_servicio('cura', true, null, '', 'efectivo', 0, 0, 'x');
  if (select orden from public.servicios where id = s1) <> '' then raise exception 'FAIL 4e'; end if;

  raise exception 'ALL LEGALES TESTS PASSED (rollback)';
end $$;
