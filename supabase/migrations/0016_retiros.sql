-- 0016: retiros de ganancias. El profesional guarda una cuenta de cobro (Nequi, Daviplata o banco) y pide retirar su saldo
-- (minimo $ 50.000, un retiro pendiente a la vez). El admin paga por fuera de la app y lo marca pagado con una referencia,
-- o lo rechaza con una nota. Las ganancias (nurse_details.ganancias) siguen siendo el total historico: el saldo es
-- ganancias menos los retiros pendientes o pagados. Nada se escribe desde el cliente: todo por funciones.

create table public.cuentas_cobro (
  usuario_id uuid primary key references public.profiles(id) on delete cascade,
  metodo text not null check (metodo in ('nequi', 'daviplata', 'banco')),
  banco text not null default '' check (char_length(banco) <= 40),
  tipo_cuenta text not null default '' check (tipo_cuenta in ('', 'ahorros', 'corriente')),
  numero text not null check (numero ~ '^[0-9]{7,20}$'),
  titular text not null check (char_length(titular) between 3 and 80),
  actualizado timestamptz not null default now(),
  check (metodo <> 'banco' or (banco <> '' and tipo_cuenta <> ''))
);

create table public.retiros (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  monto integer not null check (monto > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'rechazado')),
  -- Copia de la cuenta al pedir: si el profesional la cambia despues, el admin paga a la que se pidio.
  metodo text not null,
  banco text not null default '',
  tipo_cuenta text not null default '',
  numero text not null,
  titular text not null,
  referencia text not null default '',
  nota text not null default '',
  creado timestamptz not null default now(),
  resuelto_ts timestamptz
);
create index retiros_usuario_idx on public.retiros (usuario_id, creado desc);
create unique index retiro_pendiente_unico on public.retiros (usuario_id) where estado = 'pendiente';

alter table public.cuentas_cobro enable row level security;
alter table public.retiros enable row level security;
create policy cuentas_select on public.cuentas_cobro for select using (usuario_id = auth.uid());
create policy retiros_select on public.retiros for select using (usuario_id = auth.uid() or public.is_admin());
grant select on public.cuentas_cobro, public.retiros to authenticated;
alter publication supabase_realtime add table public.retiros;

-- Saldo disponible del profesional que llama.
create or replace function public.saldo_disponible() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select ganancias from public.nurse_details where usuario_id = auth.uid()), 0)
       - coalesce((select sum(monto) from public.retiros where usuario_id = auth.uid() and estado in ('pendiente', 'pagado')), 0)
$$;

create or replace function public.set_cuenta_cobro(p_metodo text, p_banco text, p_tipo text, p_numero text, p_titular text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_numero text := regexp_replace(coalesce(p_numero, ''), '[^0-9]', '', 'g');
  v_banco text := case when p_metodo = 'banco' then btrim(coalesce(p_banco, '')) else '' end;
  v_tipo text := case when p_metodo = 'banco' then coalesce(p_tipo, '') else '' end;
  v_titular text := btrim(coalesce(p_titular, ''));
begin
  if not exists (select 1 from public.nurse_details where usuario_id = auth.uid()) then raise exception 'solo_profesionales'; end if;
  if p_metodo not in ('nequi', 'daviplata', 'banco')
     or v_numero !~ '^[0-9]{7,20}$'
     or char_length(v_titular) not between 3 and 80
     or (p_metodo = 'banco' and (v_banco = '' or char_length(v_banco) > 40 or v_tipo not in ('ahorros', 'corriente')))
  then raise exception 'cuenta_invalida'; end if;
  insert into public.cuentas_cobro (usuario_id, metodo, banco, tipo_cuenta, numero, titular)
  values (auth.uid(), p_metodo, v_banco, v_tipo, v_numero, v_titular)
  on conflict (usuario_id) do update
    set metodo = excluded.metodo, banco = excluded.banco, tipo_cuenta = excluded.tipo_cuenta,
        numero = excluded.numero, titular = excluded.titular, actualizado = now();
end $$;

create or replace function public.solicitar_retiro(p_monto integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ganancias integer;
  v_comprometido integer;
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
  select coalesce(sum(monto), 0) into v_comprometido from public.retiros
  where usuario_id = auth.uid() and estado in ('pendiente', 'pagado');
  if p_monto > v_ganancias - v_comprometido then raise exception 'saldo_insuficiente'; end if;

  insert into public.retiros (usuario_id, monto, metodo, banco, tipo_cuenta, numero, titular)
  values (auth.uid(), p_monto, v_cuenta.metodo, v_cuenta.banco, v_cuenta.tipo_cuenta, v_cuenta.numero, v_cuenta.titular)
  returning id into v_id;

  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  select id, 'Retiro por pagar', 'Un profesional pidió retirar $ ' || to_char(p_monto, 'FM999G999G999'), 'info'
  from public.profiles where rol = 'admin';
  return v_id;
end $$;

create or replace function public.resolver_retiro(p_id uuid, p_pagado boolean, p_referencia text, p_nota text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ref text := btrim(coalesce(p_referencia, ''));
  v_nota text := btrim(coalesce(p_nota, ''));
  v_usuario uuid;
  v_monto integer;
begin
  if not public.is_admin() then raise exception 'solo_admin'; end if;
  if p_pagado and v_ref = '' then raise exception 'referencia_requerida'; end if;
  if not p_pagado and v_nota = '' then raise exception 'nota_requerida'; end if;
  select usuario_id, monto into v_usuario, v_monto from public.retiros where id = p_id and estado = 'pendiente' for update;
  if not found then raise exception 'retiro_no_pendiente'; end if;
  update public.retiros
  set estado = case when p_pagado then 'pagado' else 'rechazado' end,
      referencia = case when p_pagado then left(v_ref, 80) else '' end,
      nota = case when p_pagado then '' else left(v_nota, 300) end,
      resuelto_ts = now()
  where id = p_id;
  insert into public.notificaciones (user_id, titulo, cuerpo, tipo)
  values (v_usuario,
          case when p_pagado then 'Retiro pagado' else 'Retiro rechazado' end,
          case when p_pagado then 'Enviamos $ ' || to_char(v_monto, 'FM999G999G999') || ' a tu cuenta. Referencia: ' || left(v_ref, 80)
               else 'Motivo: ' || left(v_nota, 300) end,
          case when p_pagado then 'exito' else 'alerta' end);
end $$;

grant execute on function public.saldo_disponible(), public.set_cuenta_cobro(text, text, text, text, text),
  public.solicitar_retiro(integer), public.resolver_retiro(uuid, boolean, text, text) to authenticated;
revoke execute on function public.saldo_disponible(), public.set_cuenta_cobro(text, text, text, text, text),
  public.solicitar_retiro(integer), public.resolver_retiro(uuid, boolean, text, text) from anon, public;
