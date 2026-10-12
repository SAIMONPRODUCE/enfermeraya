-- 0010: endurecimiento tras auditoria. Bucket con limites, permisos minimos, ubicacion validada, pago con monto verificado.

-- Bucket de documentos: 5 MB y solo PDF o imagen.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'documentos';

-- Permisos sobrantes: la API solo necesita lo que ya se otorgo por tabla/columna.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- set_ubicacion: rangos validos de coordenadas.
create or replace function public.set_ubicacion(p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'ubicacion_invalida';
  end if;
  update public.profiles set lat = p_lat, lng = p_lng where id = auth.uid();
end $$;

-- confirmar_pago: ademas compara el monto que reporta Wompi con el esperado.
drop function if exists public.confirmar_pago(text, text, text);
create or replace function public.confirmar_pago(p_referencia text, p_estado text, p_wompi_id text, p_monto integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_servicio uuid;
  v_estado text := p_estado;
begin
  select servicio_id into v_servicio from public.pagos where referencia = p_referencia and estado = 'pendiente' for update;
  if v_servicio is null then return; end if; -- ya procesado: idempotente

  -- un APPROVED con monto distinto no despacha el servicio
  if v_estado = 'aprobado' and p_monto is distinct from (select monto_centavos from public.pagos where referencia = p_referencia) then
    v_estado := 'error';
  end if;
  update public.pagos set estado = v_estado, wompi_id = p_wompi_id where referencia = p_referencia;

  if v_estado = 'aprobado' then
    update public.servicios set pagado = true where id = v_servicio;
    perform public.despachar_seguro();
  else
    update public.servicios set estado = 'cancelado', estado_ts = now() where id = v_servicio and not pagado;
  end if;
end $$;

revoke all on function public.confirmar_pago(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.confirmar_pago(text, text, text, integer) to service_role;
