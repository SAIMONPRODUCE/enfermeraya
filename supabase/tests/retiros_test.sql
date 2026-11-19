-- Prueba de retiros (0016): cuenta de cobro, minimo, saldo, un pendiente a la vez, pago y rechazo por el admin,
-- privacidad entre profesionales y permisos reales (corre como el rol authenticated). Termina en RAISE EXCEPTION para revertir.
-- Correr: supabase db query --linked -f supabase/tests/retiros_test.sql
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  adm uuid := gen_random_uuid();
  r1 uuid; r2 uuid;
  msg text;
  n integer;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ret-a@example.invalid', '{"rol":"enfermero","nombre":"Enf Retiro A","telefono":"+573000000051","especialidad":"Inyectologia"}'::jsonb),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ret-b@example.invalid', '{"rol":"enfermero","nombre":"Enf Retiro B","telefono":"+573000000052","especialidad":"Curaciones"}'::jsonb),
    (adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ret-adm@example.invalid', '{"rol":"paciente","nombre":"Admin Retiro","telefono":"+573000000053"}'::jsonb);
  update public.profiles set rol = 'admin' where id = adm;
  update public.nurse_details set aprobado = 'aprobado', ganancias = 120000 where usuario_id = a;
  update public.nurse_details set aprobado = 'aprobado', ganancias = 30000 where usuario_id = b;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- 1) sin cuenta no puede retirar
  begin perform public.solicitar_retiro(50000); raise exception 'FAIL 1';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'sin_cuenta' then raise exception 'FAIL 1: %', msg; end if; end;

  -- 2) cuenta invalida (numero corto; banco sin tipo)
  begin perform public.set_cuenta_cobro('nequi', '', '', '123', 'Ana Perez'); raise exception 'FAIL 2a';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'cuenta_invalida' then raise exception 'FAIL 2a: %', msg; end if; end;
  begin perform public.set_cuenta_cobro('banco', 'Bancolombia', '', '12345678', 'Ana Perez'); raise exception 'FAIL 2b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'cuenta_invalida' then raise exception 'FAIL 2b: %', msg; end if; end;
  perform public.set_cuenta_cobro('nequi', 'ignorado', 'ahorros', '300 123 4567', ' Ana Perez ');
  if (select numero || '|' || banco || '|' || tipo_cuenta || '|' || titular from public.cuentas_cobro where usuario_id = a) <> '3001234567|||Ana Perez' then
    raise exception 'FAIL 2c: cuenta no normalizada';
  end if;

  -- 3) minimo y saldo
  if public.saldo_disponible() <> 120000 then raise exception 'FAIL 3: saldo %', public.saldo_disponible(); end if;
  begin perform public.solicitar_retiro(49999); raise exception 'FAIL 3a';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'monto_minimo' then raise exception 'FAIL 3a: %', msg; end if; end;
  begin perform public.solicitar_retiro(120001); raise exception 'FAIL 3b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'saldo_insuficiente' then raise exception 'FAIL 3b: %', msg; end if; end;

  -- 4) retiro valido: baja el saldo, avisa al admin, y no se puede pedir otro mientras hay uno pendiente
  r1 := public.solicitar_retiro(70000);
  if public.saldo_disponible() <> 50000 then raise exception 'FAIL 4: saldo %', public.saldo_disponible(); end if;
  begin perform public.solicitar_retiro(50000); raise exception 'FAIL 4a';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'retiro_pendiente' then raise exception 'FAIL 4a: %', msg; end if; end;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.notificaciones where user_id = adm and titulo = 'Retiro por pagar') then raise exception 'FAIL 4b: sin aviso al admin'; end if;

  -- 5) el profesional no resuelve su propio retiro; otro profesional no ve ni la cuenta ni el retiro
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin perform public.resolver_retiro(r1, true, 'X', ''); raise exception 'FAIL 5a';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'solo_admin' then raise exception 'FAIL 5a: %', msg; end if; end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.retiros; if n <> 0 then raise exception 'FAIL 5b: B ve % retiros', n; end if;
  select count(*) into n from public.cuentas_cobro; if n <> 0 then raise exception 'FAIL 5c: B ve cuentas'; end if;
  begin insert into public.retiros (usuario_id, monto, metodo, numero, titular) values (b, 99999, 'nequi', '3000000000', 'Falso'); raise exception 'FAIL 5d: inserto directo';
  exception when insufficient_privilege then null; end;
  begin update public.nurse_details set ganancias = 9999999 where usuario_id = b; if found then raise exception 'FAIL 5e: modifico ganancias'; end if;
  exception when insufficient_privilege then null; end;

  -- 6) el admin ve todo; pagar exige referencia; rechazar exige nota
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  select count(*) into n from public.retiros; if n <> 1 then raise exception 'FAIL 6a: admin ve %', n; end if;
  begin perform public.resolver_retiro(r1, true, '  ', ''); raise exception 'FAIL 6b';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'referencia_requerida' then raise exception 'FAIL 6b: %', msg; end if; end;
  begin perform public.resolver_retiro(r1, false, '', ''); raise exception 'FAIL 6c';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'nota_requerida' then raise exception 'FAIL 6c: %', msg; end if; end;

  -- 7) rechazo: el saldo vuelve y se puede pedir otro; pago: el saldo queda descontado; no se resuelve dos veces
  perform public.resolver_retiro(r1, false, '', 'Titular no coincide');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  if public.saldo_disponible() <> 120000 then raise exception 'FAIL 7a: saldo tras rechazo %', public.saldo_disponible(); end if;
  if not exists (select 1 from public.notificaciones where user_id = a and titulo = 'Retiro rechazado' and cuerpo like '%Titular no coincide%') then raise exception 'FAIL 7b: sin aviso de rechazo'; end if;
  r2 := public.solicitar_retiro(100000);
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.resolver_retiro(r2, true, 'NEQUI-8841', '');
  begin perform public.resolver_retiro(r2, true, 'OTRA', ''); raise exception 'FAIL 7c';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'retiro_no_pendiente' then raise exception 'FAIL 7c: %', msg; end if; end;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  if public.saldo_disponible() <> 20000 then raise exception 'FAIL 7d: saldo tras pago %', public.saldo_disponible(); end if;
  if (select estado || '|' || referencia from public.retiros where id = r2) <> 'pagado|NEQUI-8841' then raise exception 'FAIL 7e'; end if;

  -- 7f) un retiro cada 3 dias: con uno pagado hace 1 dia no puede pedir otro; pasados 4 dias si (y un rechazo no gasta el turno)
  reset role;
  update public.nurse_details set ganancias = 400000 where usuario_id = a;
  update public.retiros set creado = now() - interval '1 day' where id = r2;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin perform public.solicitar_retiro(50000); raise exception 'FAIL 7f';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'retiro_reciente' then raise exception 'FAIL 7f: %', msg; end if; end;
  reset role;
  update public.retiros set creado = now() - interval '4 days' where id = r2;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r1 := public.solicitar_retiro(50000);
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform public.resolver_retiro(r1, false, '', 'Prueba de rechazo');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.solicitar_retiro(50000); -- el rechazo no gasto el turno

  -- 8) el retiro conserva la cuenta con la que se pidio aunque luego cambie
  perform public.set_cuenta_cobro('banco', 'Bancolombia', 'ahorros', '12345678901', 'Ana Perez');
  if (select numero from public.retiros where id = r2) <> '3001234567' then raise exception 'FAIL 8: la copia cambio'; end if;

  -- 9) quien no es profesional aprobado no retira; anon no puede ejecutar
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin perform public.solicitar_retiro(50000); raise exception 'FAIL 9a';
  exception when others then get stacked diagnostics msg = message_text; if msg <> 'no_aprobado' then raise exception 'FAIL 9a: %', msg; end if; end;
  reset role;
  set local role anon;
  begin perform public.solicitar_retiro(50000); raise exception 'FAIL 9b: anon ejecuto';
  exception when insufficient_privilege then null; end;
  reset role;

  raise exception 'ALL RETIROS TESTS PASSED (rollback)';
end $$;
