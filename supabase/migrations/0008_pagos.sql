-- 0008: pago con tarjeta (Wompi). Un servicio pagado con tarjeta no se despacha hasta que el webhook confirma APPROVED.

alter table public.servicios add column pagado boolean not null default true;

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  servicio_id uuid not null references public.servicios(id) on delete cascade,
  referencia text not null unique,
  monto_centavos integer not null check (monto_centavos > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado', 'error')),
  wompi_id text,
  creado timestamptz not null default now()
);

alter table public.pagos enable row level security;
create policy pagos_propios on public.pagos for select
  using (exists (select 1 from public.servicios s where s.id = pagos.servicio_id and s.paciente_id = auth.uid()));
grant select on public.pagos to authenticated;
grant select, insert, update on public.pagos to service_role;

-- solicitar_servicio: con tarjeta queda sin pagar y crea el registro de pago.
create or replace function public.solicitar_servicio(
  p_servicio text, p_inmediato boolean, p_fecha timestamptz, p_notas text,
  p_metodo text, p_lat double precision, p_lng double precision, p_direccion text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_total integer;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and rol = 'paciente') then
    raise exception 'solo_pacientes';
  end if;
  if not p_inmediato and (p_fecha is null or p_fecha < now()) then
    raise exception 'fecha_invalida';
  end if;
  select c.total into v_total from public.cotizar(p_servicio, p_inmediato, p_lat, p_lng) c;

  insert into public.servicios (paciente_id, servicio_id, lat, lng, direccion, inmediato, fecha_hora,
                                notas, total, metodo_pago, oferta_inicio, pagado)
  values (auth.uid(), p_servicio, p_lat, p_lng, left(p_direccion, 200), p_inmediato,
          case when p_inmediato then null else p_fecha end,
          left(p_notas, 500), v_total, p_metodo, now(), p_metodo <> 'tarjeta')
  returning id into v_id;

  if p_metodo = 'tarjeta' then
    insert into public.pagos (servicio_id, referencia, monto_centavos)
    values (v_id, 'EY-' || replace(v_id::text, '-', ''), v_total * 100);
  else
    perform public.despachar_seguro();
  end if;
  return v_id;
end $$;

-- despachar_pendientes: solo solicitudes pagadas (0006 + filtro pagado).
create or replace function public.despachar_pendientes() returns integer
language plpgsql security definer set search_path = public as $$
declare
  s public.servicios%rowtype;
  v_nurse uuid;
  v_count integer := 0;
begin
  -- 1) Ofertas vencidas (>20 s): pasan a la siguiente enfermera y se avisa a la que no respondio.
  with vencidas as (
    update public.servicios
    set rechazados = array_append(rechazados, candidato), candidato = null, oferta_inicio = null
    where estado = 'solicitado' and candidato is not null and oferta_inicio < now() - interval '20 seconds'
    returning rechazados[cardinality(rechazados)] as nurse
  )
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select nurse, 'Solicitud expirada', 'No respondiste a tiempo.', 'alerta' from vencidas;

  -- 2) Solicitudes pagadas sin candidato: la enfermera libre mas cercana que no la haya rechazado
  for s in select * from public.servicios where estado = 'solicitado' and candidato is null and pagado order by creado for update skip locked loop
    select d.usuario_id into v_nurse
    from public.nurse_details d join public.profiles p on p.id = d.usuario_id
    where d.online and d.aprobado = 'aprobado' and p.lat is not null
      and public.km_entre(p.lat, p.lng, s.lat, s.lng) <= 10
      and not (d.usuario_id = any (s.rechazados))
      and not exists (select 1 from public.servicios x where x.enfermero_id = d.usuario_id and x.estado in ('aceptado','en_camino','en_atencion'))
      and not exists (select 1 from public.servicios x where x.candidato = d.usuario_id and x.estado = 'solicitado')
    order by public.km_entre(p.lat, p.lng, s.lat, s.lng)
    limit 1;

    if v_nurse is null then
      -- sin cobertura solo si no quedan enfermeras en linea que aun no la rechazaron
      if not exists (select 1 from public.nurse_details d where d.online and d.aprobado = 'aprobado' and not (d.usuario_id = any (s.rechazados))) then
        update public.servicios set estado = 'sin_cobertura', estado_ts = now() where id = s.id;
        insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
        values (s.paciente_id, 'Sin profesionales cerca', 'Ahora no hay enfermeros disponibles.', 'alerta');
      end if;
    else
      update public.servicios set candidato = v_nurse, oferta_inicio = now() where id = s.id;
      insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
      values (v_nurse, 'Nueva solicitud cerca', 'Hay una solicitud a tu alrededor.', 'alerta');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

-- Lo llama solo el webhook (service_role) con el estado final de Wompi.
create or replace function public.confirmar_pago(p_referencia text, p_estado text, p_wompi_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_servicio uuid;
begin
  update public.pagos set estado = p_estado, wompi_id = p_wompi_id
  where referencia = p_referencia and estado = 'pendiente'
  returning servicio_id into v_servicio;
  if v_servicio is null then return; end if; -- ya procesado: idempotente

  if p_estado = 'aprobado' then
    update public.servicios set pagado = true where id = v_servicio;
    perform public.despachar_seguro();
  else
    -- sin cobro: la solicitud no se despacha
    update public.servicios set estado = 'cancelado', estado_ts = now() where id = v_servicio and not pagado;
  end if;
end $$;

revoke all on function public.confirmar_pago(text, text, text) from public, anon, authenticated;
grant execute on function public.confirmar_pago(text, text, text) to service_role;
