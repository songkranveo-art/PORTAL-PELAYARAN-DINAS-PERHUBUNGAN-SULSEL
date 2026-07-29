-- ============================================================
-- File unduhan untuk Pengumuman Maritim (revisi 26 Jul 2026)
-- JALANKAN admin-schema.sql TERLEBIH DAHULU.
-- File itu yang membuat fungsi public.is_admin() yang dipakai di sini.
-- (Pada versi lama, fungsi tersebut dipanggil tapi tidak pernah dibuat,
--  sehingga seluruh policy storage di bawah gagal terpasang.)
-- ============================================================

alter table public.announcements
  add column if not exists file_url text,
  add column if not exists file_name text;

-- Pengaman: hentikan skrip bila is_admin() belum ada.
do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'Fungsi public.is_admin() belum ada. Jalankan admin-schema.sql lebih dulu.';
  end if;
end $$;

-- Tempat simpan file: Supabase Storage bucket publik "announcement-files"
insert into storage.buckets (id, name, public)
values ('announcement-files', 'announcement-files', true)
on conflict (id) do update set public = excluded.public;

-- Publik boleh mengunduh file pengumuman
drop policy if exists "Public read announcement files" on storage.objects;
create policy "Public read announcement files"
  on storage.objects for select
  using (bucket_id = 'announcement-files');

-- Hanya admin terdaftar yang boleh unggah / ubah / hapus
drop policy if exists "Admin upload announcement files" on storage.objects;
create policy "Admin upload announcement files"
  on storage.objects for insert
  with check (bucket_id = 'announcement-files' and public.is_admin());

drop policy if exists "Admin update announcement files" on storage.objects;
create policy "Admin update announcement files"
  on storage.objects for update
  using (bucket_id = 'announcement-files' and public.is_admin())
  with check (bucket_id = 'announcement-files' and public.is_admin());

drop policy if exists "Admin delete announcement files" on storage.objects;
create policy "Admin delete announcement files"
  on storage.objects for delete
  using (bucket_id = 'announcement-files' and public.is_admin());

-- Cek hasil:
-- select policyname from pg_policies
-- where schemaname = 'storage' and tablename = 'objects';
