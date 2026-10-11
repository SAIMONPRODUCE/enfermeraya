-- 0004: despacho periodico. Expira ofertas de mas de 20 s y reintenta solicitudes sin candidato.
-- Va aparte de 0003: si pg_cron no esta disponible, el resto sigue aplicado
-- (el despacho inmediato de 0003 cubre crear, rechazar y conectarse; sin cron solo falta la expiracion).

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('despachar-ofertas', '5 seconds', 'select public.despachar_seguro()');
