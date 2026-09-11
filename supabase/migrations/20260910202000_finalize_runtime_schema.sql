begin;

-- Todo el esquema se prepara al desplegar, nunca durante una visita o una
-- operación del administrador.
alter table public."AdminUser" add column if not exists "permissions" text;
alter table public."AdminUser" add column if not exists "active" boolean not null default true;

alter table public."Product" add column if not exists "isForMen" boolean not null default false;
create index if not exists "Product_isForMen_visible_idx"
  on public."Product" ("isForMen", "visible");

alter table public."Order" add column if not exists "stockReserved" boolean not null default false;
alter table public."Order" add column if not exists "campaignId" text;
create index if not exists "Order_campaignId_createdAt_idx"
  on public."Order" ("campaignId", "createdAt");

alter table public."Campaign" add column if not exists "productIds" text;
alter table public."Campaign" add column if not exists "bannerImage" text;
alter table public."Campaign" add column if not exists "popupImage" text;
alter table public."Campaign" add column if not exists "displayMode" text not null default 'both';
create index if not exists "Campaign_active_startAt_endAt_idx"
  on public."Campaign" ("active", "startAt", "endAt");

create table if not exists public."CampaignProduct" (
  "campaignId" text not null,
  "productId" text not null,
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "CampaignProduct_pkey" primary key ("campaignId", "productId"),
  constraint "CampaignProduct_campaignId_fkey" foreign key ("campaignId") references public."Campaign"("id") on delete cascade,
  constraint "CampaignProduct_productId_fkey" foreign key ("productId") references public."Product"("id") on delete cascade
);
create index if not exists "CampaignProduct_productId_idx"
  on public."CampaignProduct" ("productId");

create table if not exists public."ProductVariant" (
  "id" text not null,
  "productId" text not null,
  "name" text not null,
  "image" text,
  "stock" integer not null default 0,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "ProductVariant_pkey" primary key ("productId", "id"),
  constraint "ProductVariant_productId_fkey" foreign key ("productId") references public."Product"("id") on delete cascade
);
create index if not exists "ProductVariant_productId_idx"
  on public."ProductVariant" ("productId");

insert into public."ProductVariant" ("id", "productId", "name", "image", "stock", "updatedAt")
select variant->>'id', product."id", coalesce(nullif(variant->>'name', ''), 'Variante'),
  nullif(variant->>'image', ''), greatest(0, coalesce((variant->>'stock')::integer, 0)), current_timestamp
from public."Product" as product
cross join lateral jsonb_array_elements(
  case when product."variants" is null or btrim(product."variants") = '' then '[]'::jsonb else product."variants"::jsonb end
) as variant
where nullif(variant->>'id', '') is not null
on conflict ("productId", "id") do update set
  "name" = excluded."name", "image" = excluded."image", "stock" = excluded."stock", "updatedAt" = current_timestamp;

create or replace function public.sync_product_variants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public."ProductVariant" ("id", "productId", "name", "image", "stock", "updatedAt")
  select variant->>'id', new."id", coalesce(nullif(variant->>'name', ''), 'Variante'),
    nullif(variant->>'image', ''), greatest(0, coalesce((variant->>'stock')::integer, 0)), current_timestamp
  from jsonb_array_elements(
    case when new."variants" is null or btrim(new."variants") = '' then '[]'::jsonb else new."variants"::jsonb end
  ) as variant
  where nullif(variant->>'id', '') is not null
  on conflict ("productId", "id") do update set
    "name" = excluded."name", "image" = excluded."image", "stock" = excluded."stock", "updatedAt" = current_timestamp;

  update public."ProductVariant" set "stock" = 0, "updatedAt" = current_timestamp
  where "productId" = new."id" and "id" not in (
    select variant->>'id' from jsonb_array_elements(
      case when new."variants" is null or btrim(new."variants") = '' then '[]'::jsonb else new."variants"::jsonb end
    ) as variant where nullif(variant->>'id', '') is not null
  );
  return new;
end;
$$;

drop trigger if exists "Product_sync_variants" on public."Product";
create trigger "Product_sync_variants"
after insert or update of "variants" on public."Product"
for each row execute function public.sync_product_variants();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'OrderItem_productId_variantId_fkey') then
    alter table public."OrderItem" add constraint "OrderItem_productId_variantId_fkey"
      foreign key ("productId", "variantId") references public."ProductVariant"("productId", "id") not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'Order_campaignId_fkey') then
    alter table public."Order" add constraint "Order_campaignId_fkey"
      foreign key ("campaignId") references public."Campaign"("id") on delete set null;
  end if;
end
$$;

create table if not exists public."SiteSetting" (
  "key" text not null,
  "value" text not null,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "SiteSetting_pkey" primary key ("key")
);

create index if not exists "StoreEvent_type_createdAt_idx" on public."StoreEvent" ("type", "createdAt");
create index if not exists "StoreEvent_campaignId_createdAt_idx" on public."StoreEvent" ("campaignId", "createdAt");
create index if not exists "StoreEvent_productId_createdAt_idx" on public."StoreEvent" ("productId", "createdAt");
create index if not exists "CartState_updatedAt_idx" on public."CartState" ("updatedAt");
create index if not exists "CouponRedemption_couponId_createdAt_idx" on public."CouponRedemption" ("couponId", "createdAt");

insert into public."CampaignProduct" ("campaignId", "productId")
select campaign."id", selected."productId"
from public."Campaign" as campaign
cross join lateral jsonb_array_elements_text(
  case when campaign."productIds" is null or btrim(campaign."productIds") = '' then '[]'::jsonb else campaign."productIds"::jsonb end
) as selected("productId")
join public."Product" on "Product"."id" = selected."productId"
on conflict ("campaignId", "productId") do nothing;

insert into public."CommerceSetting" ("key", "value", "updatedAt")
values ('funnel_reset_at', to_char(current_timestamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), current_timestamp)
on conflict ("key") do nothing;

-- Mantiene la secuencia histórica una sola vez, igual que la preparación
-- anterior, pero fuera de las solicitudes de los clientes.
do $$
begin
  if not exists (select 1 from public."CommerceSetting" where "key" = 'order_numbers_sequential_v1') then
    perform pg_advisory_xact_lock(hashtext('famar-order-number'));
    update public."Order" set "orderNumber" = 'TMP-' || "id";
    with ranked as (
      select "id", row_number() over (order by "createdAt" asc, "id" asc) as sequence
      from public."Order"
    )
    update public."Order" as orders
    set "orderNumber" = 'FAM-' || lpad(ranked.sequence::text, 6, '0')
    from ranked
    where orders."id" = ranked."id";
    insert into public."CommerceSetting" ("key", "value", "updatedAt")
    values ('order_numbers_sequential_v1', current_timestamp::text, current_timestamp);
  end if;
end
$$;

commit;
