begin;

-- Evita que objetos con nombres coincidentes en otros esquemas alteren el
-- comportamiento del trigger. La función continúa usando las mismas tablas.
alter function public.sync_product_variants()
  set search_path = public, pg_temp;

commit;
