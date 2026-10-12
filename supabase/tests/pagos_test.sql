-- Prueba de pagos (0008, 0009, 0010, 0012): tarjeta sin pagar no se despacha, monto distinto no despacha,
-- aprobado despacha, confirmar_pago es idempotente y el pago vencido a los 15 min se cancela.
-- Termina en RAISE EXCEPTION para revertir. Correr: supabase db query --linked -f supabase/tests/pagos_test.sql
do $$
declare
  pac uuid := gen_random_uuid();
  enf uuid := gen_random_uuid();
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid;
  r record;
  ref text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (pac, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-pac@example.invalid',
          '{"rol":"paciente","nombre":"Pac Prueba","telefono":"+573000000001"}'::jsonb),
         (enf, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-enf@example.invalid',
          '{"rol":"enfermero","nombre":"Enf Prueba","telefono":"+573000000002","especialidad":"Inyectologia"}'::jsonb);
  update public.profiles set direccion = 'Calle 1', lat = 4.60, lng = -74.20 where id = pac;
  update public.profiles set lat = 4.60, lng = -74.20 where id = enf;
  update public.nurse_details set aprobado = 'aprobado', online = true where usuario_id = enf;
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);

  -- 1) tarjeta sin pagar: no se despacha y el pago pendiente tiene monto = total * 100
  s1 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 4.60, -74.20, 'Calle 1');
  perform public.despachar_pendientes();
  select pagado, candidato, total into r from public.servicios where id = s1;
  if r.pagado or r.candidato is not null then raise exception 'FAIL 1: servicio sin pagar se despacho: %', r; end if;
  if (select monto_centavos from public.pagos where servicio_id = s1) <> r.total * 100 then raise exception 'FAIL 1: monto del pago'; end if;

  -- 1b) transferencia se cobra como tarjeta: no se despacha sin pago y crea el pago pendiente
  s4 := public.solicitar_servicio('inyect', true, null, '', 'transferencia', 4.60, -74.20, 'Calle 1');
  perform public.despachar_pendientes();
  select pagado, candidato into r from public.servicios where id = s4;
  if r.pagado or r.candidato is not null or not exists (select 1 from public.pagos where servicio_id = s4 and estado = 'pendiente') then
    raise exception 'FAIL 1b: transferencia sin cobro: %', r;
  end if;

  -- 1c) la ubicacion y la direccion del servicio salen del perfil aunque el cliente mande otras
  s5 := public.solicitar_servicio('inyect', true, null, '', 'efectivo', 1.00, -70.00, 'Otra direccion');
  select lat, lng, direccion into r from public.servicios where id = s5;
  if r.lat <> 4.60 or r.lng <> -74.20 or r.direccion <> 'Calle 1' then raise exception 'FAIL 1c: uso datos del cliente: %', r; end if;
  update public.servicios set estado = 'cancelado', candidato = null where id = s5;

  -- 2) APPROVED con monto distinto: pago en error, servicio cancelado, sin despacho
  perform public.confirmar_pago('EY-' || replace(s1::text, '-', ''), 'aprobado', 'w1', 1);
  select p.estado pago, s.estado, s.pagado, s.candidato into r from public.pagos p join public.servicios s on s.id = p.servicio_id where s.id = s1;
  if r.pago <> 'error' or r.estado <> 'cancelado' or r.pagado or r.candidato is not null then raise exception 'FAIL 2: %', r; end if;

  -- 3) APPROVED con monto correcto: pagado y despachado a la enfermera mas cercana
  s2 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 4.60, -74.20, 'Calle 1');
  ref := 'EY-' || replace(s2::text, '-', '');
  perform public.confirmar_pago(ref, 'aprobado', 'w2', (select total * 100 from public.servicios where id = s2));
  select p.estado pago, s.pagado, s.candidato into r from public.pagos p join public.servicios s on s.id = p.servicio_id where s.id = s2;
  if r.pago <> 'aprobado' or not r.pagado or r.candidato is distinct from enf then raise exception 'FAIL 3: %', r; end if;

  -- 4) idempotente: un evento posterior no cambia un pago ya procesado
  perform public.confirmar_pago(ref, 'rechazado', 'w3', 1);
  if (select estado from public.pagos where referencia = ref) <> 'aprobado' then raise exception 'FAIL 4: no idempotente'; end if;

  -- 5) vencimiento: sin pago a los 16 min se cancela, el pago pasa a rechazado y se avisa al paciente
  s3 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 4.60, -74.20, 'Calle 1');
  update public.servicios set creado = now() - interval '16 minutes' where id = s3;
  perform public.despachar_pendientes();
  select s.estado, p.estado pago into r from public.servicios s join public.pagos p on p.servicio_id = s.id where s.id = s3;
  if r.estado <> 'cancelado' or r.pago <> 'rechazado' then raise exception 'FAIL 5: %', r; end if;
  if not exists (select 1 from public.notificaciones where user_id = pac and titulo = 'Solicitud cancelada') then raise exception 'FAIL 5: sin aviso'; end if;

  raise exception 'ALL PAGOS TESTS PASSED (rollback)';
end $$;
