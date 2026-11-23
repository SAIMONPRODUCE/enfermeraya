-- Prueba de la auditoria 2026-11 (0020). Termina en RAISE EXCEPTION para revertir.
-- Correr: supabase db query --linked -f supabase/tests/auditoria2_test.sql
do $$
declare
  pac uuid := gen_random_uuid();
  pac2 uuid := gen_random_uuid();
  enf uuid := gen_random_uuid();
  adm uuid := gen_random_uuid();
  s1 uuid; s2 uuid;
  a record; b record;
  msg text;
  i int;
  ref text;
begin
  update public.catalogo set requiere_orden = false; -- 0022: la orden medica se prueba en legales_test.sql
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
    (pac, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a2-pac@example.invalid', '{"terminos":"v1-2026-11","rol":"paciente","nombre":"Pac Aud2","telefono":"+573000000071"}'::jsonb),
    (pac2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a2-pac2@example.invalid', '{"terminos":"v1-2026-11","rol":"paciente","nombre":"Pac2 Aud2","telefono":"+573000000072"}'::jsonb),
    (enf, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a2-enf@example.invalid', '{"terminos":"v1-2026-11","documento":"1012345678","reps":"110010000001","rol":"enfermero","nombre":"Enf Aud2","telefono":"+573000000073","especialidad":"Curaciones"}'::jsonb),
    (adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a2-adm@example.invalid', '{"terminos":"v1-2026-11","rol":"paciente","nombre":"Adm Aud2","telefono":"+573000000074"}'::jsonb);
  update public.profiles set rol = 'admin' where id = adm;
  update public.profiles set direccion = 'Calle 1', lat = 4.6000, lng = -74.2000 where id in (pac, pac2);
  update public.profiles set lat = 4.6123, lng = -74.2234 where id = enf;
  update public.nurse_details set online = false where usuario_id <> enf;
  update public.nurse_details set aprobado = 'aprobado', online = true, visto = now() where usuario_id = enf;

  -- 1) km_entre no falla con puntos antipodas
  perform public.km_entre(65.2845571878209, -118.81111261386972, -65.28455718682089, 61.188887386130276);

  -- 2) enfermeras_cerca y cotizar no dependen del radio ni de mover el punto dentro de la misma celda
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  select * into a from public.enfermeras_cerca(0, 0, 10) where id = enf;
  select * into b from public.enfermeras_cerca(0, 0, 0.001) where id = enf;
  if a.id is null or b.id is null then raise exception 'FAIL 2a: p_radio pequeno oculta a la enfermera'; end if;
  update public.profiles set lat = 4.6040, lng = -74.2040 where id = pac; -- misma celda 4.60/-74.20
  select * into b from public.enfermeras_cerca(0, 0, 10) where id = enf;
  if b.km is distinct from a.km then raise exception 'FAIL 2b: la distancia cambia dentro de la celda (% vs %)', a.km, b.km; end if;
  if (select desplazamiento from public.cotizar('inyect', false, 0, 0, enf)) <>
     (select desplazamiento from public.cotizar('inyect', false, 0, 0)) then raise exception 'FAIL 2c'; end if;
  update public.profiles set lat = 4.6000, lng = -74.2000 where id = pac;

  -- 3) efectivo no suma ganancias
  s1 := public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x', enf);
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  perform public.aceptar_oferta(s1);
  for i in 1..4 loop perform public.avanzar_servicio(s1); end loop;
  if (select ganancias from public.nurse_details where usuario_id = enf) <> 0 then raise exception 'FAIL 3: efectivo sumo ganancias'; end if;

  -- 4) limite de cancelaciones con enfermero ofrecido: 3 por hora
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  for i in 1..3 loop
    s2 := public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x', enf);
    perform public.cancelar_servicio(s2);
  end loop;
  s2 := public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x', enf);
  begin perform public.cancelar_servicio(s2); raise exception 'FAIL 4';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'muchas_cancelaciones' then raise exception 'FAIL 4: %', msg; end if; end;

  -- 5) color: cliente no lo cambia y el formato se valida
  set local role authenticated;
  begin update public.profiles set color = 'red;x:y' where id = pac; raise exception 'FAIL 5a';
  exception when insufficient_privilege then null; end;
  begin insert into public.nurse_details (usuario_id, especialidad) values (pac, 'x'); raise exception 'FAIL 8';
  exception when insufficient_privilege then null; end;
  reset role;
  begin update public.profiles set color = 'url(x)' where id = pac; raise exception 'FAIL 5b';
  exception when check_violation then null; end;

  -- 6) pago aprobado despues de cancelar: queda para reembolso, no despacha
  update public.servicios set estado = 'cancelado' where paciente_id = pac and estado in ('solicitado','aceptado','en_camino','en_atencion');
  perform set_config('request.jwt.claims', json_build_object('sub', pac2, 'role', 'authenticated')::text, true);
  s2 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 0, 0, 'x');
  perform public.cancelar_servicio(s2);
  ref := 'EY-' || replace(s2::text, '-', '');
  perform public.confirmar_pago(ref, 'aprobado', 'A2-TX-1', (select monto_centavos from public.pagos where servicio_id = s2));
  if (select estado from public.pagos where servicio_id = s2) <> 'por_reembolsar' then raise exception 'FAIL 6a: %', (select estado from public.pagos where servicio_id = s2); end if;
  if (select estado from public.servicios where id = s2) <> 'cancelado' then raise exception 'FAIL 6b'; end if;

  -- 6c) pago vencido aprobado tarde: queda para reembolso con su transaccion
  s2 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 0, 0, 'x');
  update public.servicios set creado = now() - interval '16 minutes' where id = s2;
  perform public.despachar_pendientes();
  ref := 'EY-' || replace(s2::text, '-', '');
  perform public.confirmar_pago(ref, 'aprobado', 'A2-TX-2', (select monto_centavos from public.pagos where servicio_id = s2));
  if (select estado || '|' || coalesce(wompi_id, '-') from public.pagos where servicio_id = s2) <> 'por_reembolsar|A2-TX-2' then raise exception 'FAIL 6c'; end if;

  -- 7) revocar con servicio activo: se cancela, se reembolsa y ella ya no avanza
  s2 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 0, 0, 'x', enf);
  ref := 'EY-' || replace(s2::text, '-', '');
  perform public.confirmar_pago(ref, 'aprobado', 'A2-TX-3', (select monto_centavos from public.pagos where servicio_id = s2));
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  update public.nurse_details set online = true, visto = now() where usuario_id = enf;
  perform public.despachar_pendientes();
  perform public.aceptar_oferta(s2);
  perform public.avanzar_servicio(s2);
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.aprobar_enfermero(enf, false);
  if (select estado from public.servicios where id = s2) <> 'cancelado' or (select estado from public.pagos where servicio_id = s2) <> 'por_reembolsar' then
    raise exception 'FAIL 7a';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  begin perform public.avanzar_servicio(s2); raise exception 'FAIL 7b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'no_aprobado' then raise exception 'FAIL 7b: %', msg; end if; end;

  raise exception 'ALL AUDITORIA2 TESTS PASSED (rollback)';
end $$;
