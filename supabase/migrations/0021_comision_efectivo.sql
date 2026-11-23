-- 0021: comision de servicios en efectivo. El paciente le paga el total al profesional; el 15 % queda como deuda
-- del profesional con la plataforma. La deuda se descuenta del saldo (de lo que gane por tarjeta o transferencia)
-- o se paga aparte y un admin registra el abono. Con deuda mayor a $ 100.000 no puede conectarse.

alter table public.servicios add column comision integer not null default 0 check (comision >= 0);

create table public.abonos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete restrict,
  monto integer not null check (monto > 0),
  referencia text not null check (length(referencia) between 3 and 80),
  admin_id uuid not null references public.profiles(id),
  creado timestamptz not null default now()
);
create index abonos_usuario_idx on public.abonos (usuario_id, creado desc);
alter table public.abonos enable row level security;
create policy abonos_select on public.abonos for select using (usuario_id = auth.uid() or public.is_admin());
grant select on public.abonos to authenticated;

create or replace function public.limite_deuda() returns integer language sql immutable as $$ select 100000 $$;

-- Saldo = ganancias - retiros pendientes o pagados - (comisiones de efectivo - abonos). Negativo = debe comision.
create or replace function public.saldo_de(p_usuario uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select ganancias from public.nurse_details where usuario_id = p_usuario), 0)
       - coalesce((select sum(monto) from public.retiros where usuario_id = p_usuario and estado in ('pendiente', 'pagado')), 0)
       - coalesce((select sum(comision) from public.servicios where enfermero_id = p_usuario), 0)
       + coalesce((select sum(monto) from public.abonos where usuario_id = p_usuario), 0)
$$;

create or replace function public.saldo_disponible() returns integer
language sql stable security definer set search_path = public as $$ select public.saldo_de(auth.uid()) $$;

create or replace function public.avanzar_servicio(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios%rowtype;
  v_neto integer;
begin
  if not exists (select 1 from public.nurse_details where usuario_id = auth.uid() and aprobado = 'aprobado') then
    raise exception 'no_aprobado';
  end if;
  select * into s from public.servicios where id = p_id and enfermero_id = auth.uid() for update;
  if not found then raise exception 'no_asignado'; end if;

  if s.estado = 'aceptado' then
    update public.servicios set estado = 'en_camino', estado_ts = now() where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo)
    values (s.paciente_id, 'Tu enfermero va en camino', E'Salió hacia tu ubicación.');
    return 'en_camino';
  elsif s.estado = 'en_camino' and not s.llego then
    update public.servicios set llego = true where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
    values (s.paciente_id, E'¡Tu enfermero llegó!', E'Ya está en tu puerta.', 'exito');
    return 'llego';
  elsif s.estado = 'en_camino' then
    update public.servicios set estado = 'en_atencion', estado_ts = now() where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo)
    values (s.paciente_id, E'Atención iniciada', E'El procedimiento comenzó.');
    return 'en_atencion';
  elsif s.estado = 'en_atencion' then
    update public.servicios set estado = 'completado', estado_ts = now() where id = p_id;
    insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
    values (s.paciente_id, 'Servicio completado', E'Cuéntanos cómo te fue y califica la atención.', 'exito');
    if s.metodo_pago = 'efectivo' then
      -- El paciente le paga en efectivo al profesional: la plataforma no recibio dinero, no hay saldo que retirar.
            -- La comision (15 %) queda como deuda del profesional con la plataforma; se descuenta de su saldo.
      v_neto := round(s.total * 0.85)::integer;
      update public.servicios set comision = s.total - v_neto where id = p_id;
      update public.nurse_details set servicios = servicios + 1 where usuario_id = auth.uid();
      insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
      values (auth.uid(), 'Servicio en efectivo completado',
              'Cobra el total al paciente. Comision de la plataforma: $ ' || replace(to_char(s.total - v_neto, 'FM999G999G999'), ',', '.') || '.', 'exito');
      -- Pasado el limite de deuda se desconecta hasta que pague.
      if public.saldo_de(auth.uid()) < -public.limite_deuda() then
        update public.nurse_details set online = false where usuario_id = auth.uid();
        insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
        values (auth.uid(), 'Comision por pagar', 'Tu deuda de comisiones pasa el limite. Pagala para volver a conectarte.', 'alerta');
      end if;
    else
      v_neto := round(s.total * 0.85)::integer;
      update public.nurse_details set ganancias = ganancias + v_neto, servicios = servicios + 1 where usuario_id = auth.uid();
      insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
      values (auth.uid(), 'Ganancia registrada', '+ $ ' || replace(to_char(v_neto, 'FM999G999G999'), ',', '.'), 'exito');
    end if;
    return 'completado';
  end if;
  raise exception 'transicion_invalida';
end $$;

create or replace function public.solicitar_retiro(p_monto integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ganancias integer;
  v_cuenta public.cuentas_cobro;
  v_id uuid;
begin
  -- Bloquea la fila del profesional: dos retiros simultaneos no pueden gastar el mismo saldo.
  select ganancias into v_ganancias from public.nurse_details
  where usuario_id = auth.uid() and aprobado = 'aprobado' for update;
  if not found then raise exception 'no_aprobado'; end if;
  select * into v_cuenta from public.cuentas_cobro where usuario_id = auth.uid();
  if not found then raise exception 'sin_cuenta'; end if;
  if p_monto is null or p_monto < 50000 then raise exception 'monto_minimo'; end if;
  if exists (select 1 from public.retiros where usuario_id = auth.uid() and estado = 'pendiente') then raise exception 'retiro_pendiente'; end if;
  -- Un retiro cada 3 dias, contado desde el ultimo pedido que no fue rechazado (un rechazo no gasta el turno).
  if exists (select 1 from public.retiros where usuario_id = auth.uid() and estado <> 'rechazado' and creado > now() - interval '3 days') then raise exception 'retiro_reciente'; end if;
  if p_monto > public.saldo_de(auth.uid()) then raise exception 'saldo_insuficiente'; end if;

  insert into public.retiros (usuario_id, monto, metodo, banco, tipo_cuenta, numero, titular)
  values (auth.uid(), p_monto, v_cuenta.metodo, v_cuenta.banco, v_cuenta.tipo_cuenta, v_cuenta.numero, v_cuenta.titular)
  returning id into v_id;

  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select id, 'Retiro por pagar', 'Un profesional pidió retirar $ ' || to_char(p_monto, 'FM999G999G999'), 'info'
  from public.profiles where rol = 'admin';
  return v_id;
end $$;


CREATE OR REPLACE FUNCTION public.set_online(p_online boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_online and public.saldo_de(auth.uid()) < -public.limite_deuda() then raise exception 'deuda_pendiente'; end if;
  update public.nurse_details set online = p_online, visto = now()
  where usuario_id = auth.uid() and aprobado = 'aprobado';
  if not found then raise exception 'no_aprobado'; end if;
  if p_online then perform public.despachar_seguro(); end if;
end $function$;

-- Admin: registra el pago de comisiones que el profesional hizo por fuera (transferencia, Nequi).
create or replace function public.registrar_abono(p_usuario uuid, p_monto integer, p_referencia text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_debe integer;
begin
  if not public.is_admin() then raise exception 'solo_admin'; end if;
  if length(trim(coalesce(p_referencia, ''))) < 3 then raise exception 'referencia_requerida'; end if;
  perform 1 from public.nurse_details where usuario_id = p_usuario for update;
  if not found then raise exception 'solo_profesionales'; end if;
  v_debe := greatest(0, -public.saldo_de(p_usuario));
  if p_monto is null or p_monto <= 0 or p_monto > v_debe then raise exception 'abono_invalido'; end if;
  insert into public.abonos (usuario_id, monto, referencia, admin_id) values (p_usuario, p_monto, left(trim(p_referencia), 80), auth.uid());
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  values (p_usuario, 'Pago de comision registrado', '$ ' || replace(to_char(p_monto, 'FM999G999G999'), ',', '.') || ' (ref. ' || left(trim(p_referencia), 80) || ').', 'exito');
end $$;

-- Admin: profesionales que deben comision.
create or replace function public.deudas_comision() returns table(usuario_id uuid, debe integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo_admin'; end if;
  return query
    select d.usuario_id, -public.saldo_de(d.usuario_id)
    from public.nurse_details d where public.saldo_de(d.usuario_id) < 0
    order by 2 desc;
end $$;

revoke execute on function public.limite_deuda(), public.saldo_de(uuid), public.registrar_abono(uuid, integer, text), public.deudas_comision() from public, anon;
grant execute on function public.registrar_abono(uuid, integer, text), public.deudas_comision() to authenticated;
