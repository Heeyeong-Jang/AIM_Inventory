
create table skus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text check (category in ('cosmetics', 'medical')),
  volume text,
  safety_stock integer default 0,
  unit_price integer default 0,
  supplier text,
  created_at timestamptz default now()
);

create table inventory (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid references skus(id) on delete cascade,
  quantity integer default 0,
  lot_number text,
  expires_at date,
  updated_at timestamptz default now()
);

create table inbound_orders (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid references skus(id),
  supplier text,
  quantity integer,
  expected_at date,
  status text check (status in ('pending', 'in_transit', 'confirmed', 'received')) default 'pending',
  created_at timestamptz default now()
);

create table outbound_logs (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid references skus(id),
  quantity integer,
  lot_number text,
  destination text,
  channel text,
  shipped_at timestamptz default now()
);

-- Enable RLS
alter table skus enable row level security;
alter table inventory enable row level security;
alter table inbound_orders enable row level security;
alter table outbound_logs enable row level security;

-- RLS policies for authenticated users
create policy "Authenticated users full access on skus" on skus for all to authenticated using (true) with check (true);
create policy "Authenticated users full access on inventory" on inventory for all to authenticated using (true) with check (true);
create policy "Authenticated users full access on inbound_orders" on inbound_orders for all to authenticated using (true) with check (true);
create policy "Authenticated users full access on outbound_logs" on outbound_logs for all to authenticated using (true) with check (true);
