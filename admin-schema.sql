-- Supabase schema untuk Portal Maritim Sulsel
create table if not exists public.ship_schedules (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  ship_name text not null,
  departure_date date,
  departure_time time,
  status text not null default 'tersedia',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_name text,
  phone text,
  type text not null default 'laporan umum',
  location text,
  detail text,
  status text not null default 'baru',
  created_at timestamptz default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  status text not null default 'aktif',
  priority text not null default 'normal',
  created_at timestamptz default now()
);

create table if not exists public.port_contacts (
  id uuid primary key default gen_random_uuid(),
  port_name text not null,
  contact_name text,
  phone text,
  address text,
  notes text,
  created_at timestamptz default now()
);

-- Aktifkan RLS
alter table public.ship_schedules enable row level security;
alter table public.reports enable row level security;
alter table public.announcements enable row level security;
alter table public.port_contacts enable row level security;

-- Public boleh baca data layanan tertentu
create policy if not exists "Public read schedules" on public.ship_schedules for select using (true);
create policy if not exists "Public read announcements" on public.announcements for select using (status = 'aktif');
create policy if not exists "Public read port contacts" on public.port_contacts for select using (true);

-- Public boleh kirim laporan
create policy if not exists "Public insert reports" on public.reports for insert with check (true);

-- User login boleh mengelola semua data via admin panel
create policy if not exists "Authenticated manage schedules" on public.ship_schedules for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy if not exists "Authenticated manage reports" on public.reports for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy if not exists "Authenticated manage announcements" on public.announcements for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy if not exists "Authenticated manage port contacts" on public.port_contacts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
