-- Prueba de tarifas (0018): rango, cotizacion con el profesional elegido o el mas cercano, ubicacion del servidor,
-- despacho que respeta la tarifa pagada y permisos. Termina en RAISE EXCEPTION para revertir.
-- Correr: supabase db query --linked -f supabase/tests/tarifas_test.sql
do $$
declare
  pac uuid := gen_random_uuid();
  a uuid := gen_random_uuid(); -- cerca, cobra 50.000
  b uuid := gen_random_uuid(); -- mas lejos, precio sugerido 35.000
  s1 uuid; s2 uuid;
  q record;
  q2 record;
  msg text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
    (pac, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tar-pac@example.invalid', '{"rol":"paciente","nombre":"Pac Tarifa","telefono":"+573000000061"}'::jsonb),
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tar-a@example.invalid', '{"rol":"enfermero","nombre":"Enf Tarifa A","telefono":"+573000000062","especialidad":"Inyectologia"}'::jsonb),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tar-b@example.invalid', '{"rol":"enfermero","nombre":"Enf Tarifa B","telefono":"+573000000063","especialidad":"Inyectologia"}'::jsonb);
  update public.profiles set direccion = 'Calle 1', lat = 4.60, lng = -74.20 where id = pac;
  update public.profiles set lat = 4.601, lng = -74.20 where id = a;
  update public.profiles set lat = 4.62, lng = -74.20 where id = b;
  update public.nurse_details set online = false where usuario_id not in (a, b);
  update public.nurse_details set aprobado = 'aprobado', online = true, visto = now() where usuario_id in (a, b);

  -- 1) set_tarifa: solo profesionales, dentro del rango, se puede cambiar
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  begin perform public.set_tarifa('inyect', 40000); raise exception 'FAIL 1a';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'solo_profesionales' then raise exception 'FAIL 1a: %', msg; end if; end;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin perform public.set_tarifa('inyect', 24999); raise exception 'FAIL 1b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'tarifa_fuera_de_rango' then raise exception 'FAIL 1b: %', msg; end if; end;
  begin perform public.set_tarifa('inyect', 56001); raise exception 'FAIL 1c';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'tarifa_fuera_de_rango' then raise exception 'FAIL 1c: %', msg; end if; end;
  begin perform public.set_tarifa('nada', 40000); raise exception 'FAIL 1d';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'tarifa_fuera_de_rango' then raise exception 'FAIL 1d: %', msg; end if; end;
  perform public.set_tarifa('inyect', 45000);
  perform public.set_tarifa('inyect', 50000);
  if public.tarifa_de(a, 'inyect') <> 50000 or public.tarifa_de(b, 'inyect') <> 35000 then raise exception 'FAIL 1e: tarifas'; end if;

  -- 2) no se escribe directo en tarifas
  set local role authenticated;
  begin
    insert into public.tarifas (enfermero_id, servicio_id, precio) values (a, 'inyect', 1);
    raise exception 'FAIL 2: insert directo';
  exception when insufficient_privilege then null; end;
  reset role;

  -- 3) cotizar: sin eleccion usa al mas cercano (A, 50.000); eligiendo B usa su tarifa; no revela al mas cercano
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  select * into q from public.cotizar('inyect', false, 0, 0);
  if q.base <> 50000 or q.enfermero is not null then raise exception 'FAIL 3a: %', q; end if;
  select * into q from public.cotizar('inyect', false, 0, 0, b);
  if q.base <> 35000 or q.enfermero <> b then raise exception 'FAIL 3b: %', q; end if;
  -- 4) cotizar ignora las coordenadas del cliente
  select * into q2 from public.cotizar('inyect', false, 4.9, -74.9, b);
  if q2.desplazamiento <> q.desplazamiento then raise exception 'FAIL 4: uso coordenadas del cliente'; end if;
  -- 5) elegido desconectado
  update public.nurse_details set online = false where usuario_id = b;
  begin perform public.cotizar('inyect', false, 0, 0, b); raise exception 'FAIL 5';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'enfermero_no_disponible' then raise exception 'FAIL 5: %', msg; end if; end;
  update public.nurse_details set online = true, visto = now() where usuario_id = b;

  -- 6) pedido eligiendo a B: la oferta va a B aunque A este mas cerca; se guarda la tarifa
  s1 := public.solicitar_servicio('inyect', false, now() + interval '1 day', '', 'efectivo', 0, 0, 'x', b);
  if (select candidato from public.servicios where id = s1) is distinct from b then raise exception 'FAIL 6: no fue al elegido'; end if;
  if (select tarifa || '|' || preferido from public.servicios where id = s1) <> '35000|' || b then raise exception 'FAIL 6: tarifa/preferido'; end if;

  -- 7) B rechaza: A cobra mas que lo pagado, no recibe la oferta y queda sin cobertura
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.rechazar_oferta(s1);
  perform public.despachar_pendientes();
  if (select estado || '|' || coalesce(candidato::text, '-') from public.servicios where id = s1) <> 'sin_cobertura|-' then
    raise exception 'FAIL 7: %', (select estado || '|' || coalesce(candidato::text, '-') from public.servicios where id = s1);
  end if;

  -- 8) pedido sin eleccion: cotiza con A (50.000); si A rechaza, B (35.000 <= 50.000) recibe la oferta por el mismo total
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  s2 := public.solicitar_servicio('inyect', false, now() + interval '1 day', '', 'efectivo', 0, 0, 'x');
  if (select candidato from public.servicios where id = s2) is distinct from a or (select tarifa from public.servicios where id = s2) <> 50000 then
    raise exception 'FAIL 8a';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.rechazar_oferta(s2);
  perform public.despachar_pendientes();
  if (select candidato from public.servicios where id = s2) is distinct from b then raise exception 'FAIL 8b: no paso a B'; end if;

  -- 9) servicio inactivo (0019, toma de muestras): no se cotiza, no se pide y no admite tarifa
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  begin perform public.cotizar('muestras', false, 0, 0); raise exception 'FAIL 9a';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'servicio_desconocido' then raise exception 'FAIL 9a: %', msg; end if; end;
  update public.servicios set estado = 'cancelado' where paciente_id = pac;
  begin perform public.solicitar_servicio('muestras', true, null, '', 'efectivo', 0, 0, 'x'); raise exception 'FAIL 9b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'servicio_desconocido' then raise exception 'FAIL 9b: %', msg; end if; end;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin perform public.set_tarifa('muestras', 45000); raise exception 'FAIL 9c';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'tarifa_fuera_de_rango' then raise exception 'FAIL 9c: %', msg; end if; end;

  -- 10) anon no cotiza ni fija tarifas
  set local role anon;
  begin perform public.set_tarifa('inyect', 40000); raise exception 'FAIL 10a';
  exception when insufficient_privilege then null; end;
  begin perform public.cotizar('inyect', false, 0, 0); raise exception 'FAIL 10b';
  exception when insufficient_privilege then null; end;
  reset role;

  raise exception 'ALL TARIFAS TESTS PASSED (rollback)';
end $$;
