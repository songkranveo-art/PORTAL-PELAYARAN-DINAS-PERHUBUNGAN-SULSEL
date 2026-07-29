-- ============================================================
-- Portal Maritim Sulsel — skema + keamanan (revisi 26 Jul 2026)
-- Jalankan SELURUH file ini di Supabase SQL Editor.
-- Aman dijalankan ulang (idempoten).
--
-- CATATAN PENTING:
-- Versi lama memakai "create policy if not exists", yang BUKAN sintaks
-- PostgreSQL yang sah, sehingga policy tidak pernah terbentuk.
-- Versi ini memakai "drop policy if exists" + "create policy".
--
-- Versi lama juga memberi hak penuh ke SEMUA akun yang sekadar login
-- (auth.role() = 'authenticated'). Versi ini membatasi ke daftar admin.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABEL DATA
-- ------------------------------------------------------------
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
  file_url text,
  file_name text,
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

-- ------------------------------------------------------------
-- 2. DAFTAR ADMIN
--    Hanya user yang ada di tabel ini yang boleh mengubah data.
-- ------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

alter table public.admin_users enable row level security;

-- Fungsi pengecek admin. SECURITY DEFINER supaya bisa membaca admin_users
-- tanpa terjebak RLS-nya sendiri (kalau tidak, hasilnya selalu false).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admin baca daftar admin" on public.admin_users;
create policy "Admin baca daftar admin"
  on public.admin_users for select
  using (public.is_admin());

-- ------------------------------------------------------------
-- 3. REM ANTI-SPAM UNTUK LAPORAN PUBLIK
-- ------------------------------------------------------------
-- Batas panjang teks. NOT VALID = baris lama dibiarkan, baris baru dicek.
do $$
begin
  alter table public.reports
    add constraint reports_panjang_wajar check (
      char_length(coalesce(reporter_name, '')) <= 120 and
      char_length(coalesce(phone, ''))         <= 30  and
      char_length(coalesce(type, ''))          <= 60  and
      char_length(coalesce(location, ''))      <= 200 and
      char_length(coalesce(detail, ''))        <= 1500
    ) not valid;
exception
  when duplicate_object then null;
end $$;

-- Pembatas laju: maksimal 20 laporan/menit secara keseluruhan,
-- dan maksimal 3 laporan per 10 menit dari nomor HP yang sama.
create or replace function public.reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.reports
      where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Terlalu banyak laporan masuk saat ini. Coba lagi sebentar lagi.';
  end if;

  if new.phone is not null and char_length(new.phone) > 5 then
    if (select count(*) from public.reports
        where phone = new.phone
          and created_at > now() - interval '10 minutes') >= 3 then
      raise exception 'Nomor ini sudah mengirim beberapa laporan. Mohon tunggu 10 menit.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reports_rate_limit on public.reports;
create trigger trg_reports_rate_limit
  before insert on public.reports
  for each row execute function public.reports_rate_limit();

create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_phone_idx on public.reports (phone);

-- ------------------------------------------------------------
-- 4. AKTIFKAN RLS
-- ------------------------------------------------------------
alter table public.ship_schedules enable row level security;
alter table public.reports        enable row level security;
alter table public.announcements  enable row level security;
alter table public.port_contacts  enable row level security;

-- ------------------------------------------------------------
-- 5. HAK AKSES PUBLIK (pengunjung portal, tanpa login)
-- ------------------------------------------------------------
drop policy if exists "Public read schedules" on public.ship_schedules;
create policy "Public read schedules"
  on public.ship_schedules for select
  using (true);

drop policy if exists "Public read announcements" on public.announcements;
create policy "Public read announcements"
  on public.announcements for select
  using (status = 'aktif');

drop policy if exists "Public read port contacts" on public.port_contacts;
create policy "Public read port contacts"
  on public.port_contacts for select
  using (true);

-- Publik boleh MENGIRIM laporan, tapi tidak boleh membacanya.
-- (Tidak ada policy SELECT untuk publik = laporan orang lain tertutup.)
drop policy if exists "Public insert reports" on public.reports;
create policy "Public insert reports"
  on public.reports for insert
  with check (true);

-- ------------------------------------------------------------
-- 6. HAK AKSES ADMIN
--    Sebelumnya: siapa pun yang punya akun. Sekarang: hanya admin_users.
-- ------------------------------------------------------------
drop policy if exists "Authenticated manage schedules"     on public.ship_schedules;
drop policy if exists "Authenticated manage reports"       on public.reports;
drop policy if exists "Authenticated manage announcements" on public.announcements;
drop policy if exists "Authenticated manage port contacts" on public.port_contacts;

drop policy if exists "Admin kelola jadwal" on public.ship_schedules;
create policy "Admin kelola jadwal"
  on public.ship_schedules for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin kelola laporan" on public.reports;
create policy "Admin kelola laporan"
  on public.reports for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin kelola pengumuman" on public.announcements;
create policy "Admin kelola pengumuman"
  on public.announcements for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin kelola kontak" on public.port_contacts;
create policy "Admin kelola kontak"
  on public.port_contacts for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 7. LANGKAH TERAKHIR — WAJIB, JANGAN DILEWATI
-- ============================================================
-- a) Buat akun admin Anda di Dashboard Supabase:
--       Authentication > Users > Add user
--
-- b) Daftarkan akun itu sebagai admin (ganti alamat emailnya):
--
--    insert into public.admin_users (user_id, email)
--    select id, email from auth.users where email = 'admin@dishubsulsel.web.id'
--    on conflict (user_id) do nothing;
--
-- c) MATIKAN PENDAFTARAN MANDIRI:
--       Authentication > Sign In / Providers > Email
--       > nonaktifkan "Allow new users to sign up"
--    Tanpa langkah ini, orang luar masih bisa membuat akun sendiri.
--    Mereka tidak lagi bisa mengubah data (sudah dibatasi admin_users),
--    tapi tetap bisa memenuhi tabel pengguna Anda.
--
-- d) Cek hasilnya:
--    select tablename, policyname from pg_policies
--    where schemaname = 'public' order by tablename;
-- ============================================================
