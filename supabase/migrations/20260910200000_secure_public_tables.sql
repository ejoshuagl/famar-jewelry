begin;

-- La aplicación accede a estas tablas mediante Prisma usando la conexión
-- PostgreSQL del servidor. Los clientes no necesitan acceso directo a través
-- de PostgREST, por lo que se cierra anon/authenticated y se activa RLS.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'Category',
    'Product',
    'Review',
    'AdminUser',
    'OrderItem',
    'AuditLog',
    'ProductVariant',
    'CampaignProduct',
    'Order',
    'CartState',
    'Campaign',
    'CouponRedemption',
    'SiteSetting',
    'ProductImageMigrationBackup',
    'CommerceSetting',
    'DiscountCoupon',
    'StoreEvent'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all privileges on table public.%I from anon', table_name);
    execute format('revoke all privileges on table public.%I from authenticated', table_name);
  end loop;
end
$$;

commit;
