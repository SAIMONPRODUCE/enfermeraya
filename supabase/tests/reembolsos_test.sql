-- Prueba de reembolsos (0014): cancelar un servicio pagado, sin cobertura tras pagar, resultado de la anulacion
-- y paso a manual tras 5 intentos. Termina en RAISE EXCEPTION para revertir.
-- Correr: supabase db query --linked -f supabase/tests/reembolsos_test.sql
do $$
declare
  pac uuid := gen_random_uuid();
  enf uuid := gen_random_uuid();
  adm uuid := gen_random_uuid();
  s1 uuid; s2 uuid; s3 uuid;
  ref1 text; ref2 text;
  r record;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (pac, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ree-pac@example.invalid',
          '{"rol":"paciente","nombre":"Pac Reembolso","telefono":"+573000000021"}'::jsonb),
         (enf, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ree-enf@example.invalid',
          '{"rol":"enfermero","nombre":"Enf Reembolso","telefono":"+573000000022","especialidad":"Inyectologia"}'::jsonb),
         (adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ree-adm@example.invalid',
          '{"rol":"paciente","nombre":"Adm Reembolso","telefono":"+573000000023"}'::jsonb);
  update public.profiles set rol = 'admin' where id = adm;
  update public.profiles set direccion = 'Calle 1', lat = 4.60, lng = -74.20 where id = pac;
  update public.profiles set lat = 4.60, lng = -74.20 where id = enf;
  update public.nurse_details set aprobado = 'aprobado', online = true where usuario_id = enf;

  -- 1) pagado y aceptado, el paciente cancela: el pago queda por reembolsar y se avisa
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  s1 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 0, 0, 'x');
  ref1 := 'EY-' || replace(s1::text, '-', '');
  perform public.confirmar_pago(ref1, 'aprobado', 'W-R1', (select monto_centavos from public.pagos where referencia = ref1));
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  perform public.aceptar_oferta(s1);
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  perform public.cancelar_servicio(s1);
  if (select estado from public.pagos where referencia = ref1) <> 'por_reembolsar' then raise exception 'FAIL 1: el pago no quedo por reembolsar'; end if;
  if not exists (select 1 from public.notificaciones where user_id = pac and titulo = 'Reembolso en proceso') then raise exception 'FAIL 1: sin aviso'; end if;

  -- 2) cancelar sin haber pagado no genera reembolso
  s2 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 0, 0, 'x');
  perform public.cancelar_servicio(s2);
  if (select estado from public.pagos where servicio_id = s2) <> 'pendiente' then raise exception 'FAIL 2: reembolso de un pago que no existio'; end if;

  -- 3) sin cobertura tras pagar: el pago queda por reembolsar y el aviso lo dice
  update public.nurse_details set online = false; -- ninguna enfermera en linea
  s3 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 0, 0, 'x');
  ref2 := 'EY-' || replace(s3::text, '-', '');
  perform public.confirmar_pago(ref2, 'aprobado', 'W-R2', (select monto_centavos from public.pagos where referencia = ref2));
  select p.estado pago, s.estado into r from public.pagos p join public.servicios s on s.id = p.servicio_id where p.referencia = ref2;
  if r.estado <> 'sin_cobertura' or r.pago <> 'por_reembolsar' then raise exception 'FAIL 3: %', r; end if;
  if not exists (select 1 from public.notificaciones where user_id = pac and cuerpo like '%devolveremos el pago%') then raise exception 'FAIL 3: aviso sin mencionar el reembolso'; end if;

  -- 4) resultado de la anulacion: fallo conserva el estado y guarda la nota; exito marca reembolsado y avisa
  perform public.registrar_reembolso(ref1, false, 'Wompi respondio 422');
  select estado, reembolso_nota into r from public.pagos where referencia = ref1;
  if r.estado <> 'por_reembolsar' or r.reembolso_nota is null then raise exception 'FAIL 4a: %', r; end if;
  perform public.registrar_reembolso(ref1, true, 'anulado en Wompi (APPROVED)');
  if (select estado from public.pagos where referencia = ref1) <> 'reembolsado' then raise exception 'FAIL 4b: no marco reembolsado'; end if;
  if not exists (select 1 from public.notificaciones where user_id = pac and titulo = 'Reembolso realizado') then raise exception 'FAIL 4b: sin aviso'; end if;
  perform public.registrar_reembolso(ref1, false, 'otro intento'); -- ya reembolsado: no cambia
  if (select estado from public.pagos where referencia = ref1) <> 'reembolsado' then raise exception 'FAIL 4c: reabrio un reembolso'; end if;

  -- 5) el job: cuenta el intento y, tras 5, pasa a manual y avisa a los admin
  perform public.procesar_reembolsos();
  if (select reembolso_intentos from public.pagos where referencia = ref2) <> 1 then raise exception 'FAIL 5a: no conto el intento'; end if;
  update public.pagos set reembolso_intentos = 5 where referencia = ref2;
  perform public.procesar_reembolsos();
  if (select estado from public.pagos where referencia = ref2) <> 'reembolso_manual' then raise exception 'FAIL 5b: no paso a manual'; end if;
  if not exists (select 1 from public.notificaciones where user_id = adm and titulo = 'Reembolso manual requerido') then raise exception 'FAIL 5b: sin aviso al admin'; end if;

  raise exception 'ALL REEMBOLSOS TESTS PASSED (rollback)';
end $$;
