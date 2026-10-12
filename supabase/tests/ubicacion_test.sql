-- Prueba de 0010/0011: perfil nuevo sin ubicacion, sin_ubicacion al pedir, ubicacion_invalida. Termina en RAISE EXCEPTION para revertir.
-- Correr: supabase db query --linked -f supabase/tests/ubicacion_test.sql  (esperado: ALL UBICACION TESTS PASSED)
do $$
declare
  u uuid := gen_random_uuid();
  r record;
  msg text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-ubic@example.invalid',
          '{"rol":"paciente","nombre":"Prueba","telefono":"+573000000000"}'::jsonb);
  select direccion, lat, lng into r from public.profiles where id = u;
  if r.direccion <> '' or r.lat is not null or r.lng is not null then raise exception 'FAIL perfil nuevo trae ubicacion: %', r; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  begin
    perform public.solicitar_servicio('inyect', true, null, '', 'efectivo', 4.7, -74.07, 'x');
    raise exception 'FAIL pidio sin ubicacion';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg <> 'sin_ubicacion' then raise exception 'FAIL mensaje inesperado: %', msg; end if;
  end;
  update public.profiles set direccion = 'Calle 1', lat = 4.7, lng = -74.07 where id = u;
  begin
    perform public.set_ubicacion(95, 0);
    raise exception 'FAIL acepto latitud 95';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg <> 'ubicacion_invalida' then raise exception 'FAIL mensaje set_ubicacion: %', msg; end if;
  end;
  perform public.solicitar_servicio('inyect', true, null, '', 'efectivo', 4.7, -74.07, 'Calle 1');
  raise exception 'ALL UBICACION TESTS PASSED (rollback)';
end $$;
