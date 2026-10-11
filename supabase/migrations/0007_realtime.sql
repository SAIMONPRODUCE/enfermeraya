-- 0007: Realtime. Las tablas se publican para que el cliente reciba cambios.
-- RLS filtra lo que llega a cada usuario: cada uno solo recibe sus servicios, notificaciones y ficha.
-- Ofertas: el candidato no ve su oferta en servicios, as\u00ed que su aviso llega por notificaciones.

alter publication supabase_realtime add table public.servicios, public.notificaciones, public.nurse_details;
