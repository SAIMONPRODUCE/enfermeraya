-- 0002: permisos de tabla para el rol authenticated.
-- Con "Automatically expose new tables" desactivado, Supabase no otorga privilegios por defecto.
-- RLS limita las filas; estos GRANT limitan las operaciones. Escrituras de negocio van por RPC.

grant select on public.profiles, public.nurse_details, public.catalogo, public.servicios, public.notificaciones
  to authenticated;

-- Registro: el propio perfil y la ficha de profesional (RLS exige estado inicial).
grant insert on public.profiles, public.nurse_details to authenticated;

-- Marcar notificaciones como leidas (RLS restringe a las propias).
grant update (leida) on public.notificaciones to authenticated;

-- Las policies RLS llaman is_admin(); sin este EXECUTE fallan con permission denied.
-- Solo devuelve si el usuario actual es admin: seguro para authenticated.
grant execute on function public.is_admin() to authenticated;
