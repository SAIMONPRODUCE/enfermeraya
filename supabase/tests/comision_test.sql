-- Prueba de la comision de efectivo (0021). Termina en RAISE EXCEPTION para revertir.
-- Correr: supabase db query --linked -f supabase/tests/comision_test.sql
do $$
declare
  pac uuid := gen_random_uuid();
  enf uuid := gen_random_uuid();
  otra uuid := gen_random_uuid();
  adm uuid := gen_random_uuid();
  s1 uuid; s2 uuid;
  v_total integer; v_com integer;
  i int;
  msg text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
    (pac, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'co-pac@example.invalid', '{"rol":"paciente","nombre":"Pac Comision","telefono":"+573000000081"}'::jsonb),
    (enf, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'co-enf@example.invalid', '{"rol":"enfermero","nombre":"Enf Comision","telefono":"+573000000082"}'::jsonb),
    (otra, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'co-otra@example.invalid', '{"rol":"enfermero","nombre":"Otra Comision","telefono":"+573000000083"}'::jsonb),
    (adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'co-adm@example.invalid', '{"rol":"paciente","nombre":"Adm Comision","telefono":"+573000000084"}'::jsonb);
  update public.profiles set rol = 'admin' where id = adm;
  update public.profiles set direccion = 'Calle 1', lat = 4.60, lng = -74.20 where id = pac;
  update public.profiles set lat = 4.601, lng = -74.20 where id = enf;
  update public.nurse_details set online = false where usuario_id <> enf;
  update public.nurse_details set aprobado = 'aprobado', online = true, visto = now() where usuario_id in (enf, otra);
  update public.nurse_details set online = false where usuario_id = otra;

  -- 1) servicio en efectivo: comision = total - 85 %, saldo negativo por ese valor
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  s1 := public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x', enf);
  select total into v_total from public.servicios where id = s1;
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  perform public.aceptar_oferta(s1);
  for i in 1..4 loop perform public.avanzar_servicio(s1); end loop;
  v_com := v_total - round(v_total * 0.85)::integer;
  if (select comision from public.servicios where id = s1) <> v_com then raise exception 'FAIL 1a: comision'; end if;
  if public.saldo_disponible() <> -v_com then raise exception 'FAIL 1b: saldo %', public.saldo_disponible(); end if;
  if (select ganancias from public.nurse_details where usuario_id = enf) <> 0 then raise exception 'FAIL 1c'; end if;

  -- 2) una ganancia por tarjeta compensa la deuda
  update public.nurse_details set ganancias = 60000 where usuario_id = enf;
  if public.saldo_disponible() <> 60000 - v_com then raise exception 'FAIL 2'; end if;
  insert into public.cuentas_cobro (usuario_id, metodo, numero, titular) values (enf, 'nequi', '3001234567', 'Enf Comision');
  begin perform public.solicitar_retiro(60000); raise exception 'FAIL 2b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'saldo_insuficiente' then raise exception 'FAIL 2b: %', msg; end if; end;
  update public.nurse_details set ganancias = 0 where usuario_id = enf;

  -- 3) pasado el limite de deuda: se desconecta y no puede volver a conectarse
  update public.servicios set comision = 100001 where id = s1;
  begin perform public.set_online(true); raise exception 'FAIL 3';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'deuda_pendiente' then raise exception 'FAIL 3: %', msg; end if; end;

  -- 4) abonos: solo admin, no mas de lo que debe, y reducen la deuda
  begin perform public.registrar_abono(enf, 1000, 'NEQUI-1'); raise exception 'FAIL 4a';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'solo_admin' then raise exception 'FAIL 4a: %', msg; end if; end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin perform public.registrar_abono(enf, 100002, 'NEQUI-1'); raise exception 'FAIL 4b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'abono_invalido' then raise exception 'FAIL 4b: %', msg; end if; end;
  if not exists (select 1 from public.deudas_comision() where usuario_id = enf and debe = 100001) then raise exception 'FAIL 4c'; end if;
  perform public.registrar_abono(enf, 100001, 'NEQUI-1');
  if exists (select 1 from public.deudas_comision() where usuario_id = enf) then raise exception 'FAIL 4d'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  perform public.set_online(true); -- ya sin deuda

  -- 5) privacidad y escritura: otra profesional no ve los abonos; nadie inserta directo
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', otra, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.abonos where usuario_id = enf) then raise exception 'FAIL 5a'; end if;
  begin insert into public.abonos (usuario_id, monto, referencia, admin_id) values (otra, 1, 'xxx', otra); raise exception 'FAIL 5b';
  exception when insufficient_privilege then null; end;
  begin perform public.saldo_de(enf); raise exception 'FAIL 5c';
  exception when insufficient_privilege then null; end;
  reset role;

  raise exception 'ALL COMISION TESTS PASSED (rollback)';
end $$;
