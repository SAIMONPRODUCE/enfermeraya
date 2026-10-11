-- Pruebas de RPC de 0001_init.sql.
-- Todo corre en UNA transaccion y termina en RAISE EXCEPTION: asi nada queda en la base.
-- Resultado esperado: 'ALL RPC TESTS PASSED'. Cualquier 'FAIL ...' indica el caso que fallo.
-- Solo ASCII: no pegar acentos desde el portapapeles (se corrompen).

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.as_reset() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Ejecuta stmt como el usuario actual y exige un error que contenga 'expected'.
create or replace function pg_temp.expect_err(stmt text, expected text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: sin error (esperado %)', expected;
exception when others then
  if sqlerrm not like '%' || expected || '%' then
    raise exception 'FAIL: error "%" (esperado %)', sqlerrm, expected;
  end if;
end $$;

do $$
declare
  p uuid := gen_random_uuid();
  n1 uuid := gen_random_uuid();
  n2 uuid := gen_random_uuid();
  n3 uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  s1 uuid;
  s2 uuid;
  cand uuid;
  r record;
  tot integer;
  cnt integer;
  est text;
  txt text;
  g integer;
  sv integer;
  cal numeric;
  ap text;
begin
  -- ===== Fixtures (como postgres, sin RLS) =====
  insert into auth.users (id, email, aud, role) values
    (p, 'p@test.co', 'authenticated', 'authenticated'),
    (n1, 'n1@test.co', 'authenticated', 'authenticated'),
    (n2, 'n2@test.co', 'authenticated', 'authenticated'),
    (n3, 'n3@test.co', 'authenticated', 'authenticated'),
    (a, 'a@test.co', 'authenticated', 'authenticated');
  insert into public.profiles (id, rol, nombre, telefono, lat, lng, calificacion) values
    (p, 'paciente', 'Paciente Test', '3001234567', 4.7143, -74.0645, 5),
    (n1, 'enfermero', 'Nurse Uno', '3001111111', 4.7143, -74.0645, 1),
    (n2, 'enfermero', 'Nurse Dos', '3002222222', 4.7150, -74.0650, 5),
    (n3, 'enfermero', 'Nurse Tres', '3003333333', 4.7143, -74.0645, 5),
    (a, 'admin', 'Admin Test', '3004444444', null, null, 5);
  insert into public.nurse_details (usuario_id, especialidad, aprobado, online, servicios) values
    (n1, 'General', 'aprobado', true, 10),
    (n2, 'General', 'aprobado', true, 0),
    (n3, 'General', 'pendiente', false, 0);

  -- ===== 1. Cotizacion =====
  select * into r from public.cotizar('inyect', true, 4.7143, -74.0645);
  if r.total <> 44000 then raise exception 'FAIL cotizar total=% (esperado 44000)', r.total; end if;

  -- ===== 2. Solo pacientes solicitan; fecha pasada rechazada =====
  perform pg_temp.as_user(n1);
  perform pg_temp.expect_err(format('select public.solicitar_servicio(%L,true,null,%L,%L,%s,%s,%L)',
    'inyect', 'x', 'efectivo', 4.7143, -74.0645, 'Cra 15'), 'solo_pacientes');

  perform pg_temp.as_user(p);
  perform pg_temp.expect_err(format('select public.solicitar_servicio(%L,false,%L,%L,%L,%s,%s,%L)',
    'inyect', now() - interval '1 day', '', 'efectivo', 4.7143, -74.0645, 'Cra 15'), 'fecha_invalida');

  -- total NO viene del cliente: se recalcula en servidor
  s1 := public.solicitar_servicio('inyect', true, null, 'Test nota', 'efectivo', 4.7143, -74.0645, 'Cra 15 #93-40');
  select total into tot from public.servicios where id = s1;
  if tot <> 44000 then raise exception 'FAIL total servicio=% (esperado 44000)', tot; end if;

  -- ===== 3. Despacho inmediato al solicitar (0003): candidato = enfermera mas cercana =====
  perform pg_temp.as_reset();
  select candidato into cand from public.servicios where id = s1;
  if cand <> n1 then raise exception 'FAIL candidato=% (esperado n1)', cand; end if;

  -- ===== 4. Ofertas visibles solo al candidato =====
  perform pg_temp.as_user(n1);
  select count(*) into cnt from public.mis_ofertas();
  if cnt <> 1 then raise exception 'FAIL mis_ofertas n1=% (esperado 1)', cnt; end if;
  perform pg_temp.as_user(p);
  select count(*) into cnt from public.mis_ofertas();
  if cnt <> 0 then raise exception 'FAIL mis_ofertas paciente=% (esperado 0)', cnt; end if;

  -- ===== 5. Aceptar: solo el candidato =====
  perform pg_temp.as_user(n2);
  perform pg_temp.expect_err(format('select public.aceptar_oferta(%L)', s1), 'oferta_no_valida');
  perform pg_temp.as_user(n1);
  perform public.aceptar_oferta(s1);
  perform pg_temp.as_reset();
  select estado into est from public.servicios where id = s1;
  if est <> 'aceptado' then raise exception 'FAIL estado tras aceptar=% (esperado aceptado)', est; end if;

  -- ===== 6. Enfermera ocupada no recibe nueva oferta =====
  perform pg_temp.as_user(p);
  s2 := public.solicitar_servicio('cura', true, null, '', 'efectivo', 4.7143, -74.0645, 'Cra 15 bis');
  perform pg_temp.as_reset();
  perform public.despachar_pendientes();
  select candidato into cand from public.servicios where id = s2;
  if cand <> n2 then raise exception 'FAIL n1 ocupada pero candidato=% (esperado n2)', cand; end if;

  -- ===== 7. Maquina de estados: solo asignada, transiciones validas =====
  perform pg_temp.as_user(n2);
  perform pg_temp.expect_err(format('select public.avanzar_servicio(%L)', s1), 'no_asignado');
  perform pg_temp.as_user(n1);
  txt := public.avanzar_servicio(s1); if txt <> 'en_camino' then raise exception 'FAIL paso1=%', txt; end if;
  txt := public.avanzar_servicio(s1); if txt <> 'llego' then raise exception 'FAIL paso2=%', txt; end if;
  txt := public.avanzar_servicio(s1); if txt <> 'en_atencion' then raise exception 'FAIL paso3=%', txt; end if;
  txt := public.avanzar_servicio(s1); if txt <> 'completado' then raise exception 'FAIL paso4=%', txt; end if;

  -- ===== 8. Ganancia 85% y conteo, sumados en servidor =====
  perform pg_temp.as_reset();
  select ganancias, servicios into g, sv from public.nurse_details where usuario_id = n1;
  if g <> 37400 then raise exception 'FAIL ganancias=% (esperado 37400)', g; end if;
  if sv <> 11 then raise exception 'FAIL servicios=% (esperado 11)', sv; end if;

  -- ===== 9. Calificacion: promedio sobre n-1 previos; una sola vez =====
  perform pg_temp.as_user(p);
  perform public.calificar_servicio(s1, 5::smallint, 'bien');
  perform pg_temp.as_reset();
  select calificacion into cal from public.profiles where id = n1;
  if cal <> 1.4 then raise exception 'FAIL calificacion=% (esperado 1.4)', cal; end if;
  perform pg_temp.as_user(p);
  perform pg_temp.expect_err(format('select public.calificar_servicio(%L,5::smallint,%L)', s1, 'otra'), 'no_calificable');
  perform pg_temp.expect_err(format('select public.cancelar_servicio(%L)', s1), 'no_cancelable');

  -- ===== 10. Cancelar solicitud abierta =====
  perform public.cancelar_servicio(s2);
  perform pg_temp.as_reset();
  select estado into est from public.servicios where id = s2;
  if est <> 'cancelado' then raise exception 'FAIL estado cancelado=%', est; end if;

  -- ===== 11. Profesional pendiente no se conecta; solo admin aprueba =====
  perform pg_temp.as_user(n3);
  perform pg_temp.expect_err('select public.set_online(true)', 'no_aprobado');
  perform pg_temp.as_user(p);
  perform pg_temp.expect_err(format('select public.aprobar_enfermero(%L,true)', n3), 'solo_admin');
  perform pg_temp.as_user(a);
  perform public.aprobar_enfermero(n3, true);
  perform pg_temp.as_user(n3);
  perform public.set_online(true);
  perform pg_temp.as_reset();
  select aprobado into ap from public.nurse_details where usuario_id = n3;
  if ap <> 'aprobado' then raise exception 'FAIL aprobado=%', ap; end if;

  -- ===== 12. Permisos de columna: el cliente no cambia rol ni calificacion =====
  perform pg_temp.as_user(p);
  perform pg_temp.expect_err(format('update public.profiles set rol = %L where id = %L', 'admin', p), 'permission denied');
  perform pg_temp.expect_err(format('update public.profiles set calificacion = 5 where id = %L', p), 'permission denied');

  -- ===== 13. RLS: visibilidad de servicios =====
  perform pg_temp.as_user(n2);
  select count(*) into cnt from public.servicios where id = s1;
  if cnt <> 0 then raise exception 'FAIL n2 ve servicio ajeno: %', cnt; end if;
  perform pg_temp.as_user(n1);
  select count(*) into cnt from public.servicios where id = s1;
  if cnt <> 1 then raise exception 'FAIL n1 no ve su servicio: %', cnt; end if;
  perform pg_temp.as_user(p);
  select count(*) into cnt from public.servicios where id = s1;
  if cnt <> 1 then raise exception 'FAIL paciente no ve su servicio: %', cnt; end if;

  -- ===== 14. Contactos: solo personas ligadas a mis servicios (0003) =====
  perform pg_temp.as_user(p);
  select count(*) into cnt from public.mis_contactos() where id = n1 and telefono is not null;
  if cnt <> 1 then raise exception 'FAIL paciente no ve contacto de n1: %', cnt; end if;
  select count(*) into cnt from public.mis_contactos() where id = n3;
  if cnt <> 0 then raise exception 'FAIL paciente ve a n3 sin servicio: %', cnt; end if;
  -- servicio completado: sin posicion de la enfermera
  select count(*) into cnt from public.mis_contactos() where id = n1 and lat is not null;
  if cnt <> 0 then raise exception 'FAIL posicion de n1 expuesta sin servicio activo'; end if;
  perform pg_temp.as_user(n1);
  select count(*) into cnt from public.mis_contactos() where id = p;
  if cnt <> 1 then raise exception 'FAIL n1 no ve a su paciente: %', cnt; end if;

  -- ===== 15. Rechazar pasa la oferta a otra enfermera (0003) =====
  perform pg_temp.as_user(p);
  s2 := public.solicitar_servicio('cura', true, null, '', 'efectivo', 4.7143, -74.0645, 'Cra 15 bis');
  perform pg_temp.as_reset();
  select candidato into cand from public.servicios where id = s2;
  if cand is null then raise exception 'FAIL sin candidato tras solicitar'; end if;
  perform pg_temp.as_user(cand);
  perform public.rechazar_oferta(s2);
  perform pg_temp.as_reset();
  select candidato, estado into r from public.servicios where id = s2;
  if r.candidato is null or r.candidato = cand then raise exception 'FAIL tras rechazar candidato=% (antes %)', r.candidato, cand; end if;

  -- ===== 16. Enfermeras cerca: excluye a la que tiene oferta pendiente =====
  perform pg_temp.as_user(p);
  select count(*) into cnt from public.enfermeras_cerca(4.7143, -74.0645, 10) where id = r.candidato;
  if cnt <> 0 then raise exception 'FAIL enfermeras_cerca incluye candidata con oferta'; end if;

  -- ===== 17. Documentos: solo rutas propias y solo si no esta aprobado =====
  perform pg_temp.as_user(n1);
  perform pg_temp.expect_err(format('select public.set_documentos(array[%L])', 'otro/x.pdf'), 'ruta_invalida');
  perform pg_temp.expect_err(format('select public.set_documentos(array[%L])', n1::text || '/x.pdf'), 'no_editable');

  -- ===== 18. Trigger de registro: perfil desde metadatos; nunca admin =====
  perform pg_temp.as_reset();
  a := gen_random_uuid();
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a, 'nuevo@test.co', 'authenticated', 'authenticated',
     '{"rol":"enfermero","nombre":"Nuevo Nurse","telefono":"3005555555","especialidad":"Curaciones"}');
  select aprobado into ap from public.nurse_details where usuario_id = a;
  if ap is distinct from 'pendiente' then raise exception 'FAIL trigger enfermero aprobado=%', ap; end if;
  a := gen_random_uuid();
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a, 'malo@test.co', 'authenticated', 'authenticated', '{"rol":"admin","nombre":"Malo","telefono":"3006666666"}');
  select count(*) into cnt from public.profiles where id = a;
  if cnt <> 0 then raise exception 'FAIL trigger creo perfil admin'; end if;

  -- ===== 19. Avisos al profesional (0006): ganancia y oferta vencida =====
  select count(*) into cnt from public.notificaciones where user_id = n1 and titulo = 'Ganancia registrada' and cuerpo = '+ $ 37.400';
  if cnt <> 1 then raise exception 'FAIL aviso ganancia: %', cnt; end if;
  cand := r.candidato; -- candidata actual de s2 (bloque 15)
  update public.servicios set oferta_inicio = now() - interval '30 seconds' where id = s2;
  perform public.despachar_pendientes();
  select count(*) into cnt from public.notificaciones where user_id = cand and titulo = 'Solicitud expirada';
  if cnt <> 1 then raise exception 'FAIL aviso expirada: %', cnt; end if;

  raise exception 'ALL RPC TESTS PASSED (transaccion revertida, nada persistido)';
end $$;
