-- Prueba de la auditoria (0013): un servicio activo por paciente, enfermeras_cerca sin trilateracion,
-- set_documentos con rutas validas, y un id de transaccion de Wompi no paga dos referencias.
-- Termina en RAISE EXCEPTION para revertir. Correr: supabase db query --linked -f supabase/tests/auditoria_test.sql
do $$
declare
  pac uuid := gen_random_uuid();
  enf uuid := gen_random_uuid();
  s1 uuid; s2 uuid;
  a record; b record;
  msg text;
  n int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (pac, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aud-pac@example.invalid',
          '{"rol":"paciente","nombre":"Pac Auditoria","telefono":"+573000000011"}'::jsonb),
         (enf, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aud-enf@example.invalid',
          '{"rol":"enfermero","nombre":"Enf Auditoria","telefono":"+573000000012","especialidad":"Inyectologia"}'::jsonb);
  update public.profiles set direccion = 'Calle 1', lat = 4.6001, lng = -74.2001 where id = pac;
  update public.profiles set lat = 4.6123, lng = -74.2234 where id = enf;
  update public.nurse_details set aprobado = 'aprobado', online = true where usuario_id = enf;

  -- A) un servicio activo por paciente
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  s1 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 0, 0, 'x');
  begin
    perform public.solicitar_servicio('inyect', true, null, '', 'efectivo', 0, 0, 'x');
    raise exception 'FAIL A: acepto un segundo servicio activo';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg <> 'servicio_en_curso' then raise exception 'FAIL A: mensaje %', msg; end if;
  end;
  update public.servicios set estado = 'cancelado' where id = s1;
  s2 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 0, 0, 'x'); -- libre otra vez tras cancelar

  -- B) enfermeras_cerca ignora las coordenadas del cliente (sin trilateracion) y redondea
  select count(*) into n from public.enfermeras_cerca(4.6001, -74.2001, 10) where id = enf;
  if n <> 1 then raise exception 'FAIL B: la enfermera cercana no aparece'; end if;
  select * into a from public.enfermeras_cerca(4.6001, -74.2001, 10) where id = enf;
  select * into b from public.enfermeras_cerca(4.9, -73.9, 10) where id = enf;   -- coordenadas falsas del atacante
  if b.id is null or a.km is distinct from b.km or a.lat is distinct from b.lat then raise exception 'FAIL B: depende de coordenadas del cliente: % vs %', a, b; end if;
  if a.lat <> round(a.lat::numeric, 2) or a.lng <> round(a.lng::numeric, 2) or a.km <> round(a.km::numeric, 1) then
    raise exception 'FAIL B: sin redondeo %', a;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', enf, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.enfermeras_cerca(4.6, -74.2, 10)) then raise exception 'FAIL B: un enfermero consulto enfermeras'; end if;

  -- C) set_documentos: solo <uid>/<archivo> existente en el bucket
  insert into storage.objects (bucket_id, name) values ('documentos', enf::text || '/1-diploma.pdf');
  begin
    perform public.set_documentos(array[enf::text || '/../' || pac::text || '/doc.pdf']);
    raise exception 'FAIL C: acepto ..';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg <> 'ruta_invalida' then raise exception 'FAIL C: mensaje %', msg; end if;
  end;
  begin
    perform public.set_documentos(array[enf::text || '/no-existe.pdf']);
    raise exception 'FAIL C: acepto un archivo inexistente';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg <> 'ruta_invalida' then raise exception 'FAIL C: mensaje %', msg; end if;
  end;
  update public.nurse_details set aprobado = 'pendiente' where usuario_id = enf;
  perform public.set_documentos(array[enf::text || '/1-diploma.pdf']);

  -- D) el mismo id de Wompi no paga dos referencias
  perform public.confirmar_pago('EY-' || replace(s2::text, '-', ''), 'aprobado', 'WOMPI-TX-1',
                                (select monto_centavos from public.pagos where servicio_id = s2));
  if (select estado from public.pagos where servicio_id = s2) <> 'aprobado' then raise exception 'FAIL D: primer pago'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', pac, 'role', 'authenticated')::text, true);
  update public.servicios set estado = 'cancelado', candidato = null where id = s2;
  s1 := public.solicitar_servicio('inyect', true, null, '', 'tarjeta', 0, 0, 'x');
  perform public.confirmar_pago('EY-' || replace(s1::text, '-', ''), 'aprobado', 'WOMPI-TX-1',
                                (select monto_centavos from public.pagos where servicio_id = s1));
  select p.estado pago, s.estado, s.pagado into a from public.pagos p join public.servicios s on s.id = p.servicio_id where s.id = s1;
  if a.pago <> 'error' or a.pagado or a.estado <> 'cancelado' then raise exception 'FAIL D: reutilizo la transaccion: %', a; end if;

  raise exception 'ALL AUDITORIA TESTS PASSED (rollback)';
end $$;
